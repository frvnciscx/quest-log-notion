import { runRepairRegistros } from './repair-registros.js';
import { runSyncMisiones }   from './sync-misiones.js';
import { computeXpAudit }    from './audit-xp.js';

const PERSONAJE_PAGE_ID = '357e89bc-3fee-81f7-a707-ccdde4a842ce';
const HOGUERAS_RESET = 4;

// La suma directa puede tardar; el cron no corre en el path del usuario.
export const maxDuration = 60;

/**
 * Guardia anti-stale.
 *
 * Los rollups agregados de Notion ("XP Total Stat") se calculan de forma
 * perezosa y pueden quedar cacheados con valores viejos — en octubre 2026
 * reportaban 6885 XP cuando el valor real era 9675.
 *
 * Este paso recorre todos los registros, suma el XP Ganado resuelto por
 * página (que Notion sí devuelve fresco) y escribe el total en el campo
 * "XP Total" del Personaje. /api/stats usa ese número como piso: si el
 * rollup viene por debajo, sabe que está stale y no muestra XP de menos.
 *
 * Requiere que "XP Total" sea de tipo number. Si es formula, no escribe
 * y lo reporta en el resultado.
 */
async function auditAndPersistXp(token) {
  const audit = await computeXpAudit(token, { maxPages: 25 });

  const pageRes = await fetch(`https://api.notion.com/v1/pages/${PERSONAJE_PAGE_ID}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  });
  const page = await pageRes.json();
  const prop = page?.properties?.['XP Total'];

  const out = {
    xpRealCalculado: audit.totalXpGanado,
    registrosEscaneados: audit.registrosEscaneados,
    truncado: audit.truncado,
    problemas: Object.fromEntries(
      Object.entries(audit.problemas).map(([k, v]) => [k, v.length])
    ),
  };

  if (!prop || prop.type !== 'number') {
    out.persistido = false;
    out.motivo = `"XP Total" es ${prop?.type || 'inexistente'}, se necesita number`;
    return out;
  }

  // Si el escaneo se cortó por maxPages, el total está incompleto y es MENOR
  // que el real. Persistirlo bajaría el piso y rompería justo la garantía que
  // el guardia existe para dar. Mejor dejar el piso viejo y avisar.
  if (audit.truncado) {
    out.persistido = false;
    out.motivo = 'escaneo truncado (subí maxPages); no se baja el piso con un total parcial';
    return out;
  }

  const anterior = prop.number ?? null;
  if (anterior === audit.totalXpGanado) {
    out.persistido = false;
    out.motivo = 'sin cambios';
    out.valor = anterior;
    return out;
  }

  const patch = await fetch(`https://api.notion.com/v1/pages/${PERSONAJE_PAGE_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { 'XP Total': { number: audit.totalXpGanado } },
    }),
  });

  out.persistido = patch.ok;
  out.de = anterior;
  out.a  = audit.totalXpGanado;
  if (!patch.ok) out.httpError = patch.status;
  return out;
}

/**
 * Si hoy es lunes en zona horaria México, resetea Hogueras del Personaje a 4.
 * Las Hogueras representan excepciones autorizadas (max 4 por semana).
 */
async function resetHoguerasIfMonday(token) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
  });
  const dayOfWeek = fmt.format(new Date()); // 'Mon', 'Tue', etc.
  if (dayOfWeek !== 'Mon') return { skipped: true, day: dayOfWeek };

  const r = await fetch(`https://api.notion.com/v1/pages/${PERSONAJE_PAGE_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { Hogueras: { number: HOGUERAS_RESET } },
    }),
  });
  return { skipped: false, day: dayOfWeek, ok: r.ok, value: HOGUERAS_RESET };
}

/**
 * Endpoint diario. Ejecuta en orden:
 * 1. repair-registros: vincula Personaje + Stat Ref a registros nuevos creados por Make
 * 2. sync-misiones: recalcula y escribe Progreso (+ bonus Humanidad si Épica completada)
 * 3. resetHoguerasIfMonday: si es lunes, resetea Hogueras a 4
 * 4. auditAndPersistXp: suma el XP real y lo guarda como piso anti-stale
 *
 * El paso 4 va último a propósito: es el más lento y depende de que repair
 * ya haya vinculado los registros del día.
 *
 * Configurado en vercel.json como cron diario (5:00 UTC ≈ 23:00–00:00 México).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const token = process.env.NOTION_TOKEN;
  const startedAt = new Date().toISOString();

  const result = {
    startedAt,
    repair:    null,
    sync:      null,
    hogueras:  null,
    auditXp:   null,
    duration_ms: null,
  };

  try {
    // PASO 1: Repair (debe correr ANTES de sync — sync depende de relations correctas)
    const t0 = Date.now();
    result.repair = await runRepairRegistros(token, false);
    const t1 = Date.now();
    result.repair.duration_ms = t1 - t0;

    // PASO 2: Sync misiones (usa los datos ya reparados, incluye bonus Humanidad si Épica)
    result.sync = await runSyncMisiones(token);
    const t2 = Date.now();
    result.sync.duration_ms = t2 - t1;

    // PASO 3: Reset Hogueras si es lunes
    result.hogueras = await resetHoguerasIfMonday(token);
    const t3 = Date.now();
    result.hogueras.duration_ms = t3 - t2;

    // PASO 4: Auditoría de XP + persistencia del piso anti-stale.
    // Va en try propio: si falla, los pasos 1–3 ya se aplicaron y no
    // tiene sentido devolver 500 por una verificación.
    try {
      result.auditXp = await auditAndPersistXp(token);
    } catch (e) {
      result.auditXp = { error: e.message };
    }
    const t4 = Date.now();
    result.auditXp.duration_ms = t4 - t3;

    result.duration_ms = t4 - t0;
    res.status(200).json(result);
  } catch (e) {
    result.error = e.message;
    result.stack = e.stack;
    res.status(500).json(result);
  }
}

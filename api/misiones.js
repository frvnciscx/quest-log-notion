const NOTION_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});

// IDs son database_id (URL del navegador), NO data_source_id
export const MISIONES_DB = '94334b895c7647b18e9102598bd4f5f8';
export const CATALOGO_DB = '8e3fc249c044496ba815fde16c96d1f9';
export const REGISTRO_DB = '4d07427278354af79dbb0b3091d42f77';

export { NOTION_HEADERS };

/**
 * Query con paginación. Devuelve hasta 500 items (5 páginas de 100).
 */
export async function queryDb(token, db_id, body = {}) {
  let cursor = null;
  const all = [];
  for (let i = 0; i < 5; i++) {
    const reqBody = { page_size: 100, ...body };
    if (cursor) reqBody.start_cursor = cursor;

    const r = await fetch(`https://api.notion.com/v1/databases/${db_id}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(token),
      body: JSON.stringify(reqBody),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Notion ${db_id}: ${r.status} ${txt.slice(0, 200)}`);
    }
    const data = await r.json();
    all.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

/**
 * Calcula misiones con progreso real cruzando datos de las 3 DBs.
 * Reutilizable desde otros endpoints (ej: sync-misiones).
 */
export async function computeMisiones(token) {
  const settled = await Promise.allSettled([
    queryDb(token, MISIONES_DB),
    queryDb(token, CATALOGO_DB),
    queryDb(token, REGISTRO_DB, {
      filter: { property: 'Estado', select: { equals: '✅ Completado' } },
    }),
  ]);

  const misionesRaw  = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const catalogoRaw  = settled[1].status === 'fulfilled' ? settled[1].value : [];
  const registrosRaw = settled[2].status === 'fulfilled' ? settled[2].value : [];

  const errores = {
    misiones:  settled[0].status === 'rejected' ? settled[0].reason.message : null,
    catalogo:  settled[1].status === 'rejected' ? settled[1].reason.message : null,
    registros: settled[2].status === 'rejected' ? settled[2].reason.message : null,
  };

  const habitosMap = {};
  for (const h of catalogoRaw) {
    habitosMap[h.id] = {
      id: h.id,
      nombre: h.properties?.['Hábito']?.title?.[0]?.plain_text || '(sin nombre)',
      xpValor: h.properties?.['XP Valor']?.number || 0,
      registrosIds: (h.properties?.['Registros']?.relation || []).map(r => r.id),
    };
  }

  const registrosMap = {};
  for (const r of registrosRaw) {
    registrosMap[r.id] = {
      id: r.id,
      xpGanado: r.properties?.['XP Ganado']?.formula?.number || 0,
      habitoId: r.properties?.['Hábito Ref']?.relation?.[0]?.id || null,
    };
  }

  const misiones = misionesRaw.map(m => {
    const habitosIds = (m.properties?.['Hábitos asociados']?.relation || []).map(r => r.id);
    const habitos = habitosIds.map(hid => habitosMap[hid]).filter(Boolean);

    let xpAcumulado = 0;
    let completadosTotal = 0;

    const habitosDetalle = habitos.map(h => {
      const completados = h.registrosIds
        .map(rid => registrosMap[rid])
        .filter(Boolean);
      const xp = completados.reduce((s, r) => s + (r.xpGanado || 0), 0);
      xpAcumulado += xp;
      completadosTotal += completados.length;
      return {
        id: h.id,
        nombre: h.nombre,
        xpValor: h.xpValor,
        vecesCompletado: completados.length,
        xpAcumulado: xp,
      };
    });

    const xpTargetRound = habitos.reduce((s, h) => s + h.xpValor, 0);
    const progresoVsRound = xpTargetRound > 0
      ? Math.round((xpAcumulado / xpTargetRound) * 100)
      : 0;

    // Veces Target (opcional): si está definido, se usa para progreso honesto
    // (count completadosTotal vs target). Si no, fallback a progresoVsRound.
    const vecesTarget = m.properties?.['Veces Target']?.number || 0;
    const progresoVsTarget = vecesTarget > 0
      ? Math.round((completadosTotal / vecesTarget) * 100)
      : null;

    // Progreso final que se usa en sync (capeado a 100)
    const progresoFinal = vecesTarget > 0
      ? Math.min(100, progresoVsTarget)
      : Math.min(100, progresoVsRound);

    return {
      id: m.id,
      titulo: m.properties?.['Misión']?.title?.[0]?.plain_text || '(sin título)',
      tipo: m.properties?.['Tipo']?.select?.name || null,
      estado: m.properties?.['Estado']?.select?.name || null,
      categoria: m.properties?.['Categoría']?.select?.name || null,
      dificultad: m.properties?.['Dificultad']?.select?.name || null,
      xpRecompensa: m.properties?.['XP Recompensa']?.number || 0,
      progresoManual: m.properties?.['Progreso']?.number || 0,
      xpAcumulado,
      xpTargetRound,
      progresoVsRound,
      vecesTarget,           // 0 si no está definido
      progresoVsTarget,      // null si no hay target
      progresoFinal,         // el que se usa en sync (capeado a 100)
      habitosCount: habitos.length,
      completadosTotal,
      habitos: habitosDetalle,
    };
  });

  const orderEstado = {
    '🔥 Activa': 0,
    '⚔️ En progreso': 1,
    '✅ Completada': 2,
    '🔒 Bloqueada': 3,
    '💀 Abandonada': 4,
  };
  misiones.sort((a, b) => {
    const oa = orderEstado[a.estado] ?? 99;
    const ob = orderEstado[b.estado] ?? 99;
    if (oa !== ob) return oa - ob;
    return (b.xpAcumulado || 0) - (a.xpAcumulado || 0);
  });

  return {
    count: misiones.length,
    misiones,
    _debug: {
      misionesCount: misionesRaw.length,
      catalogoCount: catalogoRaw.length,
      registrosCompletadosCount: registrosRaw.length,
      errores,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const result = await computeMisiones(NOTION_TOKEN);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}

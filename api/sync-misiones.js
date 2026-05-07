import { computeMisiones, NOTION_HEADERS } from './misiones.js';

/**
 * Calcula el progreso real de cada misión y lo escribe al campo "Progreso" en Notion.
 * Capeado a 100 (las misiones streak/count pueden generar % > 100 en el cálculo bruto).
 *
 * Endpoint manual: el usuario lo llama cuando quiere refrescar Notion.
 * Si después se quiere automatizar, agendar via vercel cron o Make scenario.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const { misiones } = await computeMisiones(NOTION_TOKEN);

    const updates = [];
    const skipped = [];

    for (const m of misiones) {
      // Si la misión no tiene hábitos asociados, no se actualiza (queda manual)
      if (m.xpTargetRound <= 0) {
        skipped.push({ id: m.id, titulo: m.titulo, reason: 'sin habitos asociados' });
        continue;
      }

      // Usar progresoFinal del cálculo (respeta Veces Target si está definido)
      const progresoCalc = m.progresoFinal ?? Math.min(100, m.progresoVsRound);
      const progresoActual = m.progresoManual;

      // Solo PATCH si cambió (evita escrituras innecesarias)
      if (progresoCalc === progresoActual) {
        skipped.push({ id: m.id, titulo: m.titulo, reason: 'sin cambio', valor: progresoActual });
        continue;
      }

      const r = await fetch(`https://api.notion.com/v1/pages/${m.id}`, {
        method: 'PATCH',
        headers: NOTION_HEADERS(NOTION_TOKEN),
        body: JSON.stringify({
          properties: { Progreso: { number: progresoCalc } },
        }),
      });

      const ok = r.ok;
      let errBody = null;
      if (!ok) errBody = (await r.text()).slice(0, 300);

      updates.push({
        id: m.id,
        titulo: m.titulo,
        before: progresoActual,
        after: progresoCalc,
        xpAcumulado: m.xpAcumulado,
        xpTargetRound: m.xpTargetRound,
        ok,
        error: errBody,
      });
    }

    res.status(200).json({
      total: misiones.length,
      updated: updates.filter(u => u.ok).length,
      failed: updates.filter(u => !u.ok).length,
      skippedCount: skipped.length,
      updates,
      skipped,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}

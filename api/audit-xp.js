const NOTION_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});

const REGISTRO_DB = '4d07427278354af79dbb0b3091d42f77';
const STATS_DB    = '4abc659f8b144de99e8900fa1478964f';

// Page IDs de los 5 Stats
const STAT_IDS = {
  '357e89bc-3fee-8114-98fa-df6b07baeb2e': 'fisico',
  '357e89bc-3fee-8167-85bc-e21315cf27a9': 'mente',
  '357e89bc-3fee-81fd-9d2f-fe5421fd10cc': 'nutricion',
  '357e89bc-3fee-811c-b4b4-d0c105e47c9a': 'habitos',
  '357e89bc-3fee-8113-8773-f5b32ab13732': 'negocio',
};

const norm = (id) => (id || '').replace(/-/g, '');
const STAT_IDS_NORM = {};
for (const [k, v] of Object.entries(STAT_IDS)) STAT_IDS_NORM[norm(k)] = v;

/**
 * Audita el XP del Registro Diario leyendo los valores REALES de
 * XP Base (rollup) y XP Ganado (formula) desde la API de Notion.
 *
 * Query params:
 *   ?desde=YYYY-MM-DD  limita el rango (default: todo)
 *   ?details=1         incluye la lista de registros problemáticos
 *   ?max=N             máximo de páginas a escanear (default 20 = 2000 registros)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const { desde, details, max } = req.query || {};
  const maxPages = Math.min(parseInt(max || '20', 10) || 20, 40);

  try {
    // ---- 1. Escanear todos los registros ----
    let cursor = null;
    let pages = 0;
    const registros = [];

    do {
      const body = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      if (desde) {
        body.filter = {
          property: 'Fecha',
          date: { on_or_after: desde },
        };
      }

      const r = await fetch(`https://api.notion.com/v1/databases/${REGISTRO_DB}/query`, {
        method: 'POST',
        headers: NOTION_HEADERS(NOTION_TOKEN),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        return res.status(r.status).json({ error: await r.text() });
      }
      const data = await r.json();
      pages++;

      for (const p of data.results || []) {
        const props = p.properties || {};
        registros.push({
          id: p.id,
          entrada:   props['Entrada']?.title?.[0]?.plain_text || '',
          estado:    props['Estado']?.select?.name || null,
          fecha:     props['Fecha']?.date?.start || null,
          xpBase:    props['XP Base']?.rollup?.number ?? null,
          xpGanado:  props['XP Ganado']?.formula?.number ?? null,
          statRefId: props['Stat Ref']?.relation?.[0]?.id || null,
          habitoRef: props['Hábito Ref']?.relation?.[0]?.id || null,
          personaje: props['Personaje']?.relation?.[0]?.id || null,
        });
      }

      cursor = data.has_more ? data.next_cursor : null;
      if (pages >= maxPages) break;
    } while (cursor);

    // ---- 2. Leer los rollups actuales del DB Stats ----
    const statsRes = await fetch(`https://api.notion.com/v1/databases/${STATS_DB}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(NOTION_TOKEN),
      body: JSON.stringify({ page_size: 10 }),
    });
    const statsData = await statsRes.json();
    const rollupPorStat = {};
    for (const row of statsData.results || []) {
      const name = row.properties['Stat']?.title?.[0]?.plain_text || '';
      const xp   = row.properties['XP Total Stat']?.rollup?.number ?? 0;
      if (name.includes('Físico'))    rollupPorStat.fisico    = xp;
      if (name.includes('Mente'))     rollupPorStat.mente     = xp;
      if (name.includes('Nutrición')) rollupPorStat.nutricion = xp;
      if (name.includes('Hábitos'))   rollupPorStat.habitos   = xp;
      if (name.includes('Negocio'))   rollupPorStat.negocio   = xp;
    }

    // ---- 3. Agregar por stat ----
    const blank = () => ({
      completados: 0, omitidos: 0, pendientes: 0,
      xpGanadoSuma: 0, xpBaseDeCompletados: 0,
    });
    const porStat = {
      fisico: blank(), mente: blank(), nutricion: blank(),
      habitos: blank(), negocio: blank(), SIN_STAT: blank(),
    };

    const problemas = {
      sinStatRef: [],
      sinHabitoRef: [],
      sinPersonaje: [],
      completadoConXpGanadoCero: [],
      completadoConXpBaseNulo: [],
      xpGanadoDistintoDeXpBase: [],
    };

    let totalXpGanado = 0;

    for (const r of registros) {
      const key = STAT_IDS_NORM[norm(r.statRefId)] || 'SIN_STAT';
      const bucket = porStat[key];

      if (r.estado === '✅ Completado') bucket.completados++;
      else if (r.estado === '❌ Omitido') bucket.omitidos++;
      else bucket.pendientes++;

      const g = r.xpGanado ?? 0;
      bucket.xpGanadoSuma += g;
      totalXpGanado += g;

      if (r.estado === '✅ Completado') {
        bucket.xpBaseDeCompletados += (r.xpBase ?? 0);
        if (g === 0) problemas.completadoConXpGanadoCero.push(r);
        if (r.xpBase === null) problemas.completadoConXpBaseNulo.push(r);
        if (r.xpBase !== null && g !== r.xpBase) problemas.xpGanadoDistintoDeXpBase.push(r);
      }

      if (!r.statRefId) problemas.sinStatRef.push(r);
      if (!r.habitoRef) problemas.sinHabitoRef.push(r);
      if (!r.personaje) problemas.sinPersonaje.push(r);
    }

    // ---- 4. Comparar suma real vs rollup de Notion ----
    const comparacion = {};
    for (const k of ['fisico', 'mente', 'nutricion', 'habitos', 'negocio']) {
      const calculado = porStat[k].xpGanadoSuma;
      const rollup    = rollupPorStat[k] ?? 0;
      comparacion[k] = {
        sumaXpGanadoCalculada: calculado,
        rollupNotion: rollup,
        diferencia: rollup - calculado,
        xpBaseDeCompletados: porStat[k].xpBaseDeCompletados,
        completados: porStat[k].completados,
        omitidos: porStat[k].omitidos,
      };
    }

    const resumen = {
      registrosEscaneados: registros.length,
      paginasEscaneadas: pages,
      truncado: cursor !== null,
      totalXpGanadoCalculado: totalXpGanado,
      totalRollupNotion: Object.values(rollupPorStat).reduce((a, b) => a + b, 0),
      conteoProblemas: Object.fromEntries(
        Object.entries(problemas).map(([k, v]) => [k, v.length])
      ),
    };

    const payload = { resumen, comparacion, porStat };

    if (details === '1') {
      payload.detalleProblemas = Object.fromEntries(
        Object.entries(problemas).map(([k, v]) => [k, v.slice(0, 50)])
      );
    }

    res.status(200).json(payload);

  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}

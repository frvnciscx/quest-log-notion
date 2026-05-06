const NOTION_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});

const REGISTRO_DB = '19a27bda-534c-4204-914e-86602ac2d28e';
const TZ = 'America/Mexico_City';

/**
 * Calcula "hoy" en zona horaria México como string YYYY-MM-DD.
 * Usa Intl.DateTimeFormat.formatToParts para máxima portabilidad
 * (más robusto que toLocaleDateString con locales que pueden variar entre runtimes).
 */
function todayInTZ(timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  // Permite override con ?date=YYYY-MM-DD (útil para debug y para días distintos)
  const overrideDate = (req.query?.date || '').match(/^\d{4}-\d{2}-\d{2}$/) ? req.query.date : null;
  const today = overrideDate || todayInTZ();

  // Para diagnóstico: rangos de fecha alternativos
  const serverNow = new Date().toISOString();

  try {
    // Query con filtro de fecha exacta
    const queryBody = {
      filter: { property: 'Fecha', date: { equals: today } },
      page_size: 25,
    };

    const r = await fetch(`https://api.notion.com/v1/databases/${REGISTRO_DB}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(NOTION_TOKEN),
      body: JSON.stringify(queryBody),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({
        error: errText,
        _debug: { today, serverNow, queryBody },
      });
    }

    const data = await r.json();

    const items = (data.results || []).map(p => ({
      id:       p.id,
      entrada:  p.properties?.['Entrada']?.title?.[0]?.plain_text || '(sin nombre)',
      estado:   p.properties?.['Estado']?.select?.name || '⬜ Pendiente',
      xpBase:   p.properties?.['XP Base']?.rollup?.number ?? 0,
      xpGanado: p.properties?.['XP Ganado']?.formula?.number ?? 0,
      fecha:    p.properties?.['Fecha']?.date?.start || null,
    }));

    // Orden: pendientes primero, luego completados, luego omitidos. Alfabético dentro.
    const order = { '⬜ Pendiente': 0, '✅ Completado': 1, '❌ Omitido': 2 };
    items.sort((a, b) => {
      const oa = order[a.estado] ?? 99;
      const ob = order[b.estado] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.entrada.localeCompare(b.entrada, 'es');
    });

    res.status(200).json({
      today,
      count: items.length,
      items,
      _debug: { serverNow, timezone: TZ, queryBody },
    });
  } catch (e) {
    res.status(500).json({
      error: e.message,
      stack: e.stack,
      _debug: { today, serverNow },
    });
  }
}

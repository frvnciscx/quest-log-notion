const NOTION_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});

const PERSONAJE_DB = '9be62f8e75094d0e8e9be41e96eeb8ca';
const STATS_DB     = '4abc659f8b144de99e8900fa1478964f';

/**
 * Escribe el xpTotal calculado al campo "XP Total" del Personaje.
 * Solo funciona si el campo es de tipo number (no formula/rollup).
 * Ejecuta el PATCH solo si el valor difiere del actual — evita writes innecesarios.
 */
async function syncXpTotalToNotion(token, pageId, xpTotalProp, xpTotal) {
  if (!xpTotalProp || xpTotalProp.type !== 'number') {
    return { status: 'skipped', reason: `field type is ${xpTotalProp?.type || 'missing'}, not number` };
  }
  const current = xpTotalProp.number ?? null;
  if (current === xpTotal) {
    return { status: 'unchanged', current };
  }
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: NOTION_HEADERS(token),
      body: JSON.stringify({
        properties: { 'XP Total': { number: xpTotal } },
      }),
    });
    if (!r.ok) return { status: 'failed', httpError: r.status, body: (await r.text()).slice(0, 300) };
    return { status: 'synced', from: current, to: xpTotal };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const [personajeRes, statsRes] = await Promise.all([
      fetch(`https://api.notion.com/v1/databases/${PERSONAJE_DB}/query`, {
        method: 'POST',
        headers: NOTION_HEADERS(NOTION_TOKEN),
        body: JSON.stringify({ page_size: 1 }),
      }),
      fetch(`https://api.notion.com/v1/databases/${STATS_DB}/query`, {
        method: 'POST',
        headers: NOTION_HEADERS(NOTION_TOKEN),
        body: JSON.stringify({ page_size: 10 }),
      }),
    ]);

    const personajeData = await personajeRes.json();
    const statsData     = await statsRes.json();

    const page  = personajeData.results[0];
    const props = page.properties;

    const readNumeric = (prop) => {
      const p = props[prop];
      if (!p) return null;
      if (p.type === 'number')  return (p.number  ?? null);
      if (p.type === 'formula') return (p.formula?.number ?? null);
      if (p.type === 'rollup')  return (p.rollup?.number  ?? null);
      return null;
    };

    // --- STATS por categoría (fuente única de verdad) ---
    const statMap = {};
    for (const row of statsData.results) {
      const name = row.properties['Stat']?.title?.[0]?.plain_text || '';
      const xp   = row.properties['XP Total Stat']?.rollup?.number || 0;
      if (name.includes('Físico'))    statMap.fisico    = xp;
      if (name.includes('Mente'))     statMap.mente     = xp;
      if (name.includes('Nutrición')) statMap.nutricion = xp;
      if (name.includes('Hábitos'))   statMap.habitos   = xp;
      if (name.includes('Negocio'))   statMap.negocio   = xp;
    }

    // --- XP TOTAL: suma directa de las 5 stats ---
    const xpTotal = (statMap.fisico    || 0)
                  + (statMap.mente     || 0)
                  + (statMap.nutricion || 0)
                  + (statMap.habitos   || 0)
                  + (statMap.negocio   || 0);

    // --- CURVA DE NIVELES (exponencial: cada nivel necesita el doble del anterior) ---
    // Threshold acumulado para nivel N: 500 * (2^(N-1) - 1)
    //  N=1: 0     | N=2: 500   | N=3: 1500  | N=4: 3500
    //  N=5: 7500  | N=6: 15500 | N=7: 31500 | N=8: 63500
    const xpToReachLevel = (n) => 500 * (Math.pow(2, n - 1) - 1);
    const levelFromXp    = (xp) => Math.floor(Math.log2(xp / 500 + 1)) + 1;

    const nivel  = Math.max(1, levelFromXp(Math.max(0, xpTotal)));
    const rangos = ['💀 Iniciado','🗡️ Aprendiz','📖 Practicante','🛡️ Especialista','💎 Experto','🔥 Maestro','⚔️ Gran Maestro','👑 Leyenda'];
    const rango  = rangos[Math.min(nivel - 1, rangos.length - 1)];

    const currentThreshold = xpToReachLevel(nivel);
    const nextLevelTarget  = xpToReachLevel(nivel + 1);
    const levelSize        = nextLevelTarget - currentThreshold;
    const cur              = xpTotal - currentThreshold;
    const filled           = Math.floor((cur / levelSize) * 10);
    const barraXP          = `Nv.${nivel} ${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${xpTotal}/${nextLevelTarget} XP`;

    // --- HUMANIDAD + HOGUERAS ---
    const humanidad     = readNumeric('Humanidad') ?? 0;
    const hogueras      = readNumeric('Hogueras') ?? 0;
    const hogueras_max  = 4;
    const estadoPersonaje = props['Estado Personaje']?.formula?.string
      || (humanidad >= 5 ? '🪙 Humano' : humanidad > 0 ? '🩸 Maldito' : '💀 Hueco');

    // --- SYNC del xpTotal calculado al Personaje (si el field es number) ---
    const syncResult = await syncXpTotalToNotion(NOTION_TOKEN, page.id, props['XP Total'], xpTotal);

    res.status(200).json({
      fisico:    statMap.fisico    || 0,
      mente:     statMap.mente     || 0,
      nutricion: statMap.nutricion || 0,
      habitos:   statMap.habitos   || 0,
      negocio:   statMap.negocio   || 0,
      xpTotal,
      nivel,
      rango,
      barraXP,
      humanidad,
      estadoPersonaje,
      hogueras,
      hogueras_max,
      _debug: {
        xpSource: 'sum of 5 stats from 📊 Stats DB (single source of truth)',
        statBreakdown: {
          fisico:    statMap.fisico    || 0,
          mente:     statMap.mente     || 0,
          nutricion: statMap.nutricion || 0,
          habitos:   statMap.habitos   || 0,
          negocio:   statMap.negocio   || 0,
        },
        notionSync: syncResult,
        xpTotalNotion: readNumeric('XP Total'),
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}

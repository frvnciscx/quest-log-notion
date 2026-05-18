const NOTION_HEADERS = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});

const PERSONAJE_DB = '9be62f8e75094d0e8e9be41e96eeb8ca';
const STATS_DB     = '4abc659f8b144de99e8900fa1478964f';
const HABITOS_DB   = '72f41711-a604-4b42-8254-6bf4243e3135'; // ⚡ Hábitos Diarios

/**
 * Suma XP Ganado de la DB ⚡ Hábitos Diarios para un personaje específico.
 * Bypassa el rollup "XP Hábitos Auto" que devuelve null en la API estándar.
 * Pagina hasta 100 items por página, hasta 10 páginas (1000 hábitos máx).
 */
async function sumXpHabitosFromSource(token, personajeId) {
  let cursor = null;
  let total = 0;
  let count = 0;
  let pages = 0;
  let error = null;

  try {
    do {
      const body = {
        filter: {
          property: 'Personaje',
          relation: { contains: personajeId },
        },
        page_size: 100,
      };
      if (cursor) body.start_cursor = cursor;

      const r = await fetch(`https://api.notion.com/v1/databases/${HABITOS_DB}/query`, {
        method: 'POST',
        headers: NOTION_HEADERS(token),
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        error = { httpError: r.status, body: (await r.text()).slice(0, 500) };
        break;
      }
      const data = await r.json();
      pages++;

      for (const habito of data.results || []) {
        const xp = habito.properties?.['XP Ganado']?.formula?.number ?? 0;
        total += xp;
        count++;
      }
      cursor = data.has_more ? data.next_cursor : null;
      if (pages >= 10) break; // safety
    } while (cursor);

    return { value: total, count, pages, error };
  } catch (e) {
    return { value: null, count, pages, error: { exception: e.message } };
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

    // --- COMPONENTES de XP manuales (number) y rollup XP Auto ---
    const xpFisico    = readNumeric('XP Físico')    ?? 0;
    const xpMente     = readNumeric('XP Mente')     ?? 0;
    const xpHabitos   = readNumeric('XP Hábitos')   ?? 0;
    const xpNutricion = readNumeric('XP Nutrición') ?? 0;
    const xpNegocio   = readNumeric('XP Negocio')   ?? 0;
    const xpAuto      = readNumeric('XP Auto')      ?? 0;

    // --- BYPASS del rollup roto: sumar XP Hábitos Auto desde DB origen ---
    const habitosResult = await sumXpHabitosFromSource(NOTION_TOKEN, page.id);
    const xpHabitosAuto = habitosResult.value ?? 0;

    // --- XP TOTAL: suma manual robusta ---
    const xpTotal = xpFisico + xpMente + xpHabitos + xpNutricion + xpNegocio + xpAuto + xpHabitosAuto;

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

    // --- STATS por categoría ---
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

    // --- HUMANIDAD + HOGUERAS ---
    const humanidad     = readNumeric('Humanidad') ?? 0;
    const hogueras      = readNumeric('Hogueras') ?? 0;
    const hogueras_max  = 4;
    const estadoPersonaje = props['Estado Personaje']?.formula?.string
      || (humanidad >= 5 ? '🪙 Humano' : humanidad > 0 ? '🩸 Maldito' : '💀 Hueco');

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
        xpSource: 'manual sum (rollup XP Hábitos Auto bypassed)',
        xpComponents: {
          'XP Físico': xpFisico,
          'XP Mente': xpMente,
          'XP Hábitos': xpHabitos,
          'XP Nutrición': xpNutricion,
          'XP Negocio': xpNegocio,
          'XP Auto': xpAuto,
          'XP Hábitos Auto (calculado)': xpHabitosAuto,
        },
        habitosBypass: {
          dbId: HABITOS_DB,
          itemsCount: habitosResult.count,
          pagesScanned: habitosResult.pages,
          error: habitosResult.error,
        },
        xpTotalNotion: readNumeric('XP Total'), // referencia: la fórmula de Notion sigue rota
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}

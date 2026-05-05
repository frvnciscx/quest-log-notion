export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const PERSONAJE_DB = '9be62f8e75094d0e8e9be41e96eeb8ca';
  const STATS_DB = '4abc659f8b144de99e8900fa1478964f';

  try {
    const [personajeRes, statsRes] = await Promise.all([
      fetch(`https://api.notion.com/v1/databases/${PERSONAJE_DB}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 1 }),
      }),
      fetch(`https://api.notion.com/v1/databases/${STATS_DB}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 10 }),
      }),
    ]);

    const personajeData = await personajeRes.json();
    const statsData = await statsRes.json();

    const page = personajeData.results[0];
    const props = page.properties;

    const getNumber  = (prop) => props[prop]?.number || 0;
    const getRollup  = (prop) => props[prop]?.rollup?.number || 0;
    const getFormula = (prop) => props[prop]?.formula?.number || 0;
    const getString  = (prop) => props[prop]?.formula?.string || '';

    // Suma todos los componentes del XP Total
    const xpTotal =
      getNumber('XP Físico') +
      getNumber('XP Mente') +
      getNumber('XP Hábitos') +
      getNumber('XP Nutrición') +
      getNumber('XP Negocio') +
      getRollup('XP Hábitos Auto') +
      getRollup('XP Auto');

    const nivel = Math.floor(xpTotal / 500) + 1;
    const rangos = ['💀 Iniciado','🗡️ Aprendiz','📖 Practicante','🛡️ Especialista','💎 Experto','🔥 Maestro','⚔️ Gran Maestro','👑 Leyenda'];
    const rango = rangos[Math.min(nivel - 1, rangos.length - 1)];

    const cur = xpTotal - (Math.floor(xpTotal / 500) * 500);
    const filled = Math.floor(cur / 50);
    const barraXP = `Nv.${nivel} ${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${cur}/500 XP`;

    const statMap = {};
    for (const row of statsData.results) {
      const name = row.properties['Stat']?.title?.[0]?.plain_text || '';
      const xp = row.properties['XP Total Stat']?.rollup?.number || 0;
      if (name.includes('Físico'))    statMap.fisico    = xp;
      if (name.includes('Mente'))     statMap.mente     = xp;
      if (name.includes('Nutrición')) statMap.nutricion = xp;
      if (name.includes('Hábitos'))   statMap.habitos   = xp;
      if (name.includes('Negocio'))   statMap.negocio   = xp;
    }

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
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = '9be62f8e75094d0e8e9be41e96eeb8ca';

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 1 }),
    });

    const data = await response.json();
    const page = data.results[0];
    const props = page.properties;

    const getNumber = (prop) => props[prop]?.number || 0;
    const getFormula = (prop) => props[prop]?.formula?.number || 0;
    const getString = (prop) => props[prop]?.formula?.string || '';

    const stats = {
      fisico:    getNumber('XP Físico'),
      mente:     getNumber('XP Mente'),
      nutricion: getNumber('XP Nutrición'),
      habitos:   getNumber('XP Hábitos'),
      negocio:   getNumber('XP Negocio'),
      xpTotal:   getFormula('XP Total'),
      nivel:     getFormula('Nivel'),
      rango:     getString('Rango'),
      barraXP:   getString('Barra XP'),
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

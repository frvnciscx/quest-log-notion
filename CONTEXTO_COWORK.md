# Contexto — Widget Development para Notion (Cowork)

## Objetivo
Desarrollar widgets embebibles en Notion que se conectan a bases de datos de Notion via API.
Los widgets viven en un repositorio de GitHub y se despliegan en Vercel.

## Stack
- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Base de datos**: Notion API
- **Deploy**: Vercel (auto-deploy desde GitHub en cada push)
- **Repo GitHub**: `frvnciscx/widget_radar`
- **URL producción**: `https://widgetradar.vercel.app`

## Carpeta local
`C:\Users\the_e\OneDrive\Documentos\varios\radar widget`

## Estructura del proyecto
```
radar-widget/
├── api/
│   ├── stats.js      ← Lee DB Personaje + DB Stats de Notion (con bypass de rollups rotos)
│   └── debug.js      ← Muestra raw JSON de Notion para debugging
├── index.html        ← Radar de stats (widget activo)
├── personaje.html    ← HUD de nivel/XP/rango (widget activo)
├── stats.html        ← 5 barras de stats compactas (widget activo)
├── vercel.json       ← Rutas de Vercel
└── package.json
```

## Widgets activos
| Widget | URL | Descripción |
|--------|-----|-------------|
| Radar de stats | `widgetradar.vercel.app` | Radar chart con 5 stats + barras |
| HUD Personaje | `widgetradar.vercel.app/personaje` | Nivel, XP, Rango, barra de progreso |
| Stats bars | `widgetradar.vercel.app/stats` | 5 barras de stats compactas, sin radar |

## Widgets pendientes por construir
| Widget | Descripción |
|--------|-------------|
| Check-in diario | Lista de hábitos del día con checkboxes interactivos |
| Misiones activas | Lista de misiones con progreso |
| Racha diaria | Días consecutivos de hábitos |

## Estética definida
- **Transparente** — fondo `transparent` para mimetizarse con Notion
- **Tipografía**: `Playfair Display` (serif elegante) + `DM Mono` (datos/labels)
- **3 temas**: Oscuro (default), Claro, Sépia/Editorial
- **Colores oscuro**: texto `#e3e3e3`, accent `#d4c5a0` (dorado hueso)
- **Sin bordes, sin sombras, sin marcos** — minimalista editorial
- El switcher de tema son 3 puntitos pequeños arriba a la izquierda

## Variables de entorno en Vercel
- `NOTION_TOKEN` — Internal Integration Token de Notion (empieza con `ntn_`)

## IDs de bases de datos Notion
| Base de datos | ID |
|---------------|-----|
| 🧙 Personaje | `9be62f8e75094d0e8e9be41e96eeb8ca` |
| 📊 Stats | `4abc659f8b144de99e8900fa1478964f` |
| 📅 Registro Diario | `19a27bda-534c-4204-914e-86602ac2d28e` |
| ⚔️ Misiones | `94334b895c7647b18e9102598bd4f5f8` |
| 📋 Catálogo de Hábitos | `a01a7ce7-014c-431c-93cb-85ecefd3fa53` |

## Historial — Bug XP Total (resuelto May 2026)
Causa raíz: el rollup `XP Hábitos Auto` apuntaba a la DB ⚡ Hábitos Diarios
que estaba en la papelera. La API de Notion devolvía null para ese rollup.
Fix aplicado:
- Notion: eliminadas las propiedades `XP Hábitos Auto` y `Hábitos completados`
  de la DB Personaje. Los 145 XP históricos se hardcodearon en `XP Hábitos`.
- Código: `api/stats.js` suma manualmente todos los componentes en lugar de
  depender de la fórmula `XP Total` de Notion. Incluye fallback con
  `pages.properties` paginado para rollups truncados.
- DBs en papelera: ⚡ Hábitos Diarios + 🏗️ Habitos (purgar cuando convenga).

## Cómo agregar un nuevo widget
1. Crear `nombre.html` en la raíz del proyecto
2. Si necesita nuevos datos de Notion, crear `api/nombre.js`
3. Agregar la ruta en `vercel.json`:
   `{ "source": "/nombre", "destination": "/nombre.html" }`
4. Commit y push — Vercel redesplega automáticamente
5. Embeber en Notion con `/embed` → URL: `widgetradar.vercel.app/nombre`

## Sistema de Notion (contexto completo)
El sistema es un tracker de hábitos gamificado con estética Dark Souls.
- **Make** crea 10 entradas en Registro Diario cada mañana a las 6am
- El usuario marca hábitos como ✅ Completado
- XP sube automáticamente en la DB Personaje via rollups
- Hub principal: https://www.notion.so/lacasitadelmolde/Quest-Log-357e89bc3fee81cd9729feb0d4bac8d0

## Referencia estética Dark Souls (para PWA futura)
- CodePen: https://codepen.io/frvnciscx/full/GgNpZpa
- GitHub Pages: https://frvnciscx.github.io/life-dashboard/

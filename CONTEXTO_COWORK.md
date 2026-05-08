# Contexto — Widget Development para Notion (Cowork)

## Objetivo
Desarrollar widgets embebibles en Notion que se conectan a bases de datos de Notion via API.
Los widgets viven en un repositorio de GitHub y se despliegan en Vercel.

## Stack
- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Base de datos**: Notion API
- **Deploy**: Vercel (auto-deploy desde GitHub en cada push)
- **Repo GitHub**: `frvnciscx/quest-log-notion`
- **URL producción**: `https://widgetradar.vercel.app`

## Carpeta local
`C:\Users\the_e\OneDrive\Documentos\varios\radar widget`

## Estructura del proyecto
```
radar-widget/
├── api/
│   ├── stats.js               ← Lee Personaje + Stats (con Humanidad y bypass de rollups)
│   ├── registro.js            ← GET hábitos del día (resuelve nombres del Catálogo, filtra pausados)
│   ├── habit-toggle.js        ← POST cambiar estado (auto -1 Humanidad si Prohibido cae)
│   ├── misiones.js            ← GET misiones con progreso calculado (exporta computeMisiones)
│   ├── sync-misiones.js       ← POST escribe Progreso a Notion (exporta runSyncMisiones)
│   ├── repair-registros.js    ← POST vincula Personaje + Stat Ref a registros sin relations (exporta runRepairRegistros)
│   ├── dedupe-registros.js    ← POST archiva duplicados de un día (deja la entrada más completa por hábito)
│   ├── cron-daily.js          ← Endpoint del cron: repair → sync → reset Hogueras (lunes)
│   └── debug.js               ← Dump raw JSON del Personaje
├── index.html                 ← Radar de stats (widget activo)
├── personaje.html             ← HUD nivel/XP/rango/Humanidad (widget activo)
├── registro.html              ← Check-in diario interactivo (widget activo)
├── vercel.json                ← Rutas + cron diario (apunta a cron-daily)
└── package.json
```

## Widgets activos
| Widget | URL | Descripción |
|--------|-----|-------------|
| Radar de stats | `widgetradar.vercel.app` | Radar chart con 5 stats + barras |
| HUD Personaje | `widgetradar.vercel.app/personaje` | Nivel, XP, Rango + **Humanidad (5 pips)** + Estado (Humano/Maldito/Hueco) |
| Check-in diario | `widgetradar.vercel.app/registro` | Hábitos del día con botones ⬜/✅/❌ + auto-humanidad |

## Widgets pendientes por construir
| Widget | Descripción |
|--------|-------------|
| Misiones activas | Lista de misiones con barras de progreso (consumiría /api/misiones) |
| Racha diaria | Días consecutivos sin caer en Prohibidos |

## Endpoints API
| Endpoint | Método | Función |
|----------|--------|---------|
| `/api/stats` | GET | Personaje + Stats + Humanidad + Estado |
| `/api/registro` | GET | Hábitos de hoy (filtra pausados, resuelve nombres) |
| `/api/habit-toggle` | POST | Cambia estado + auto-decremento Humanidad si cae en Prohibido |
| `/api/misiones` | GET | Misiones con progreso real (cruza 3 DBs) |
| `/api/sync-misiones` | GET/POST | Escribe Progreso de cada misión a Notion |
| `/api/repair-registros` | GET/POST | Vincula Personaje + Stat Ref en registros nuevos. Soporta `?dry=1` para dry-run |
| `/api/dedupe-registros` | GET/POST | Archiva duplicados de un día (`?date=YYYY-MM-DD`, default hoy). Soporta `?dry=1` |
| `/api/cron-daily` | GET/POST | Ejecuta repair → sync. Es el endpoint que llama el cron diario |
| `/api/debug` | GET | Dump raw del Personaje |

## Cron Jobs (vercel.json)
- `/api/cron-daily` — diario a las 5:00 UTC (~23:00–00:00 México). Ejecuta:
  1. **repair-registros** (vincula Personaje + Stat Ref a entradas nuevas creadas por Make)
  2. **sync-misiones** (recalcula y escribe Progreso de cada misión)

Vercel Hobby permite hasta 2 crons; este endpoint combina ambas tareas en 1 cron job.

## Estética definida
- **Transparente** — fondo `transparent` para mimetizarse con Notion
- **Tipografía**: `Playfair Display` (serif elegante) + `DM Mono` (datos/labels)
- **3 temas**: Oscuro (default), Claro, Sépia/Editorial
- **Colores oscuro**: texto `#e3e3e3`, accent `#d4c5a0` (dorado hueso)
- **Sin bordes, sin sombras, sin marcos** — minimalista editorial
- El switcher de tema son 3 puntitos pequeños arriba a la izquierda
- **Estado Hueco**: cuando Humanidad=0, el HUD muta a paleta gris-frío (sin dorado)

## Variables de entorno en Vercel
- `NOTION_TOKEN` — Internal Integration Token de Notion (de la integración Make automatización)

## IDs de bases de datos Notion (USAR DATABASE_ID, NO DATA_SOURCE_ID)
| Base de datos | database_id (público, en URL) | data_source_id (interno, NO usar en API) |
|---------------|-------------------------------|------------------------------------------|
| 🧙 Personaje | `9be62f8e75094d0e8e9be41e96eeb8ca` | `d04682b9-66f4-4c24-8362-d2896c7d1b8e` |
| 📊 Stats | `4abc659f8b144de99e8900fa1478964f` | `2508f8a9-fc4b-4a6f-9e1e-50d31f2ce71b` |
| 📅 Registro Diario | `4d07427278354af79dbb0b3091d42f77` | `19a27bda-534c-4204-914e-86602ac2d28e` |
| ⚔️ Misiones | `94334b895c7647b18e9102598bd4f5f8` | `9bed4fc3-6871-4ebe-97d2-6f03b82cf915` |
| 📋 Catálogo de Hábitos | `8e3fc249c044496ba815fde16c96d1f9` | `a01a7ce7-014c-431c-93cb-85ecefd3fa53` |

Page ID del personaje principal (Paco): `357e89bc-3fee-81f7-a707-ccdde4a842ce`

## Mecánicas RPG implementadas

### XP / Nivel / Rango
- Cada hábito tiene `XP Valor` (number)
- Al marcar `Estado = ✅ Completado`, suma XP a la stat correspondiente
- Cada 500 XP = 1 nivel
- 8 rangos: 💀 Iniciado → 👑 Leyenda

### Humanidad (5 pips, cap 0–5)
- Inicial: 5
- **Cae −1**: al marcar un Prohibido como ❌ Omitido sin hoguera (automático via /api/habit-toggle)
- **Sube +1**: 
  - Revertir Omitido en Prohibido (automático)
  - Completar misión 💀 Épica al 100% (automático via cron-daily, anti-doble-conteo con flag Humanidad Otorgada)
  - Racha 3 días sin caer / fallar 3+ hábitos (manual por ahora — roadmap en BACKLOG.md)
- Estados:
  - `🪙 Humano` — Humanidad ≥ 5
  - `🩸 Maldito` — Humanidad 1–4
  - `💀 Hueco` — Humanidad = 0 (HUD pasa a paleta gris)

### Hogueras (excepciones autorizadas)
- Pool semanal: **4 hogueras**, default
- Reset automático: cada lunes el cron-daily setea Hogueras = 4
- Uso: en `/api/habit-toggle` con `useHoguera: true` al marcar un Prohibido como Omitido
  - Si quedan hogueras: −1 Hoguera, **Humanidad intacta**
  - Si Hogueras = 0: el flag se ignora, costó −1 Humanidad
- UI: widget /registro muestra contador "🔥 X/4" + botón 🔥 en Prohibidos (deshabilitado si pool=0)
- Filosofía: reconoce que la vida tiene excepciones legítimas (cumpleaños, viajes), pero limitadas para evitar normalizar la falla

### Hábitos Prohibidos (campo Tipo en Catálogo)
- `🟢 Construir` — hábitos positivos a hacer (10 actuales)
- `🔴 Prohibido` — hábitos negativos a evitar (Mente clara, Sin azúcar)
- Para Prohibidos: ✅ Completado significa "lo evité hoy" (positivo, +XP). ❌ Omitido = "caí" (negativo, -1 humanidad).

### Frecuencia (campo en Catálogo)
- `📅 Diario` — Make crea entrada cada mañana
- `📆 Semanal` — usuario crea registro manualmente cuando lo hace
- `🎯 Eventual` — sin patrón, manual

### Veces Target (campo en Misiones)
- Para misiones streak/count: define cuántas veces hay que cumplir hábitos asociados
- `Progreso = completadosTotal / Veces Target × 100` (capeado a 100)
- Sin Veces Target: fallback a `xpAcumulado / xpTargetRound` (impreciso para streaks)

## Make scenario diario (con valores correctos)
Hoy a las 6 AM, Make hace Search en Catálogo con filtro:
- `Activo = ✅ Activo` AND `Frecuencia = 📅 Diario`

Al crear cada entrada en Registro Diario, **Make debe setear**:
- **Entrada**: nombre del hábito (texto del title)
- **Hábito Ref**: page_id del hábito iterado
- **Estado**: `⬜ Pendiente`
- **Fecha**: `formatDate(now; "YYYY-MM-DD")`
- **Personaje**: `357e89bc-3fee-81f7-a707-ccdde4a842ce` (page_id de Paco)
- **Stat Ref**: page_id del Stat correspondiente, mapeado desde `habit.Stat.name`:
  - `💪 Físico` → `357e89bc-3fee-8114-98fa-df6b07baeb2e`
  - `🧠 Mente` → `357e89bc-3fee-8167-85bc-e21315cf27a9`
  - `🥗 Nutrición` → `357e89bc-3fee-81fd-9d2f-fe5421fd10cc`
  - `📋 Hábitos` → `357e89bc-3fee-811c-b4b4-d0c105e47c9a`
  - `💼 Negocio` → `357e89bc-3fee-8113-8773-f5b32ab13732`

Si Make NO setea Personaje/Stat Ref (deuda histórica), el cron diario `/api/cron-daily` los repara cada noche. Pero los rollups no suman en tiempo real durante el día → mejor arreglar Make.

## Cómo agregar un nuevo widget
1. Crear `nombre.html` en la raíz del proyecto
2. Si necesita nuevos datos de Notion, crear `api/nombre.js`
3. Agregar la ruta en `vercel.json`:
   `{ "source": "/nombre", "destination": "/nombre.html" }`
4. Commit y push — Vercel redesplega automáticamente
5. Embeber en Notion con `/embed` → URL: `widgetradar.vercel.app/nombre`

## Sistema de Notion (contexto completo)
El sistema es un tracker de hábitos gamificado con estética Dark Souls.
- **Make** crea 10 entradas en Registro Diario cada mañana a las 6am (filtrando Diarios + Activos)
- El usuario marca hábitos como ✅ Completado / ❌ Omitido
- XP sube automáticamente en la DB Personaje via rollups
- Humanidad sube/baja automáticamente vía /api/habit-toggle
- Hub principal: https://www.notion.so/lacasitadelmolde/Quest-Log-357e89bc3fee81cd9729feb0d4bac8d0

## Historial — Bug XP Total (resuelto May 2026)
Causa raíz: el rollup `XP Hábitos Auto` apuntaba a la DB ⚡ Hábitos Diarios
que estaba en la papelera. La API de Notion devolvía null para ese rollup.
Fix aplicado:
- Notion: eliminadas las propiedades `XP Hábitos Auto` y `Hábitos completados`
  de la DB Personaje. Los 145 XP históricos se hardcodearon en `XP Hábitos`.
- Código: `api/stats.js` suma manualmente todos los componentes en lugar de
  depender de la fórmula `XP Total` de Notion.
- DBs en papelera: ⚡ Hábitos Diarios + 🏗️ Habitos (purgar cuando convenga).

## Referencia estética Dark Souls (para PWA futura)
- CodePen: https://codepen.io/frvnciscx/full/GgNpZpa
- GitHub Pages: https://frvnciscx.github.io/life-dashboard/

## Lecciones operativas (errores reincidentes a evitar)

### Notion API
- **El ID de DB que va en `/v1/databases/{id}/query` es el `database_id` (URL del navegador), NO el `data_source_id`** (`collection://...`). En DBs multi-source son distintos.
- **Mover una DB cambia su scope de permisos.** Las integraciones conectadas vía herencia (página padre) se pierden al mover al root. Reconectar Make explícitamente a cada DB suelta.
- **Rollups que apuntan a DBs en papelera devuelven `null` en API** mientras la UI muestra el cache.
- **Filtros relativos `today` no existen en la API** (sí en UI). Calcular fecha en backend con `Intl.DateTimeFormat.formatToParts` + `timeZone` explícita.
- **La API no soporta crear embeds externos** vía content updates. Solo embeds internos a páginas Notion. Embeds externos requieren UI manual con `/embed`.
- **Eliminar permanentemente desde la papelera no se puede vía API**. Solo el usuario en la UI.
- **Multi-hop rollups (rollup-of-rollup) bloqueado por Notion**: error explícito `Cannot create a rollup of a related rollup property`. Calcular en backend cruzando DBs.
- **Fórmulas con `.map(...)` sobre relations dan Type error vía DDL**, aunque la UI las acepta. Calcular en backend.

### Código
- **Antes de pedir un widget nuevo, abrir los existentes y revisarlos.** Riesgo: duplicar funcionalidad.
- **No confiar en propiedades intermedias de Notion (fórmulas/rollups) como fuente de verdad.** Sumar manualmente desde componentes individuales en el backend si la lógica es crítica.
- **Endpoints POST que mutan datos requieren auth si la URL puede filtrarse.**
- **Cuando un endpoint devuelve `[]`, distinguir entre lista vacía y error.**
- **Resolver nombres desde el Catálogo (live)**, no desde el title histórico del Registro. Permite renombrar hábitos sin romper la UI.
- **Verificar que Make setee TODAS las relations necesarias** al crear páginas. Si falta una relation, los rollups que la usan devuelven 0 — y eso parece "el sistema no funciona" cuando en realidad falta data en cada page nueva.
- **Endpoints idempotentes con dry-run mode** son críticos para herramientas de reparación. `?dry=1` reporta sin tocar; ejecutar real solo cuando se confirma.

### Proceso (trabajar con el asistente)
- **Cuando un asistente AI hace cambios estructurales en herramientas críticas, hacer checkpoint antes y diff después.**
- **Validar la memoria contra la fuente actual antes de decir "está mal".**
- **Pedir el dato crudo (JSON, screenshot) en el primer turn de debug, no esperar a iterar.**
- **El asistente debe verificar IDs/URLs/sintaxis contra la fuente real (MCP/web) antes de codificar.**
- **No agregar features sin uso comprobado.** Probar 7 días antes de capa nueva.

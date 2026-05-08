# 🎮 Quest Log — Life Gamification System

> Sistema RPG de gamificación de hábitos y objetivos personales sobre Notion.  
> Widgets HTML embebibles en vivo, backend en Vercel, mecánica universal con tema intercambiable.

**🌐 Demo en producción:** [widgetradar.vercel.app](https://widgetradar.vercel.app)  
**📘 Blueprint completo:** [`BLUEPRINT_GAMIFICATION_NOTION.md`](./BLUEPRINT_GAMIFICATION_NOTION.md)

---

## ¿Qué es esto?

Un tracker de hábitos gamificado que va más allá del "marcá la casilla". Combina:

- **5 bases de datos en Notion** que modelan personaje, atributos, hábitos, objetivos y bitácora diaria
- **Mecánica RPG con consecuencias reales**: niveles, tiers, atributos por categoría, y un Pool de Integridad que cae cuando rompés Hábitos Prohibidos
- **Widgets interactivos** embebibles en Notion que muestran progreso en vivo y permiten marcar hábitos sin salir de la página
- **Backend serverless** que cruza datos entre DBs (cosa que la API de Notion no permite hacer con rollups multi-hop) y devuelve métricas honestas
- **Cron diario** que sincroniza el progreso de cada objetivo automáticamente

Implementación de referencia con tema **Dark Souls / Fantasía Oscura**, pero la mecánica es universal y el blueprint incluye 5 temas listos para intercambiar (Fantasy clásico, Sci-fi, Wholesome/Jardín, Minimalista) más una guía para crear el tuyo.

---

## 🚀 Demo en vivo

| Widget | URL | Uso |
|---|---|---|
| **Radar de stats** | [/](https://widgetradar.vercel.app) | Radar chart con los 5 atributos + barras de progreso |
| **HUD del personaje** | [/personaje](https://widgetradar.vercel.app/personaje) | Nivel, XP, rango, **Pool de Integridad (5 pips)** y estado |
| **Check-in diario** | [/registro](https://widgetradar.vercel.app/registro) | Lista interactiva de hábitos del día con ⬜/✅/❌ + auto-update de Integridad |

Los widgets se embeben en Notion con `/embed` → URL.

---

## 🧱 Stack

- **Frontend**: HTML + CSS + JavaScript vanilla, sin build step, sin frameworks
- **Backend**: Vercel Serverless Functions (Node.js 18+, ESM)
- **Datos**: Notion API (`@notionhq/client` no se usa — fetch directo)
- **Automatización**: Make.com (creación diaria de entradas de Bitácora)
- **Deploy**: Vercel con auto-deploy desde GitHub
- **Cron**: Vercel Cron Jobs (1 ejecución diaria)

---

## 📂 Estructura del proyecto

```
.
├── api/
│   ├── stats.js          # GET personaje + atributos + integridad
│   ├── registro.js       # GET hábitos del día (resuelve nombres del Catálogo)
│   ├── habit-toggle.js   # POST estado + auto-decremento Integridad si Prohibido
│   ├── misiones.js       # GET objetivos con progreso real (cruza 3 DBs)
│   ├── sync-misiones.js  # POST escribe Progreso a Notion (manual + cron diario)
│   └── debug.js          # GET dump raw del Personaje
├── index.html            # Widget radar
├── personaje.html        # Widget HUD
├── registro.html         # Widget check-in interactivo
├── vercel.json           # Rewrites + cron jobs
├── BLUEPRINT_GAMIFICATION_NOTION.md   # Guía completa, multi-tema, comercializable
├── CONTEXTO_COWORK.md    # Contexto interno de desarrollo
└── README.md
```

---

## ⚡ Quick start

### Pre-requisitos
- Cuenta de Notion con permisos para crear DBs e integrations
- Cuenta de Vercel
- Cuenta de Make.com (free tier alcanza)

### Setup en 4 pasos

**1. Replicar las 5 DBs en Notion**  
Seguí la sección 3–4 del [blueprint](./BLUEPRINT_GAMIFICATION_NOTION.md) para crear Catálogo de Hábitos, Bitácora, Personaje, Atributos y Objetivos con sus relations y fórmulas.

**2. Crear una integration de Notion**  
Notion → Settings → Connections → Develop or manage connections → New integration. Copiá el token (empieza con `ntn_`). Conectá la integration a las 5 DBs.

**3. Deploy a Vercel**
```bash
git clone https://github.com/frvnciscx/quest-log-notion.git
cd quest-log-notion
vercel deploy
```
En el dashboard de Vercel, agregá la env var: `NOTION_TOKEN = ntn_...`

**4. Configurar Make**  
Importá el escenario diario (descripción en blueprint sección 8).
- Trigger: **6 AM** zona del usuario
- Filter: `Activo = ✅` AND `Frecuencia = 📅 Diario`
- Action: crear entrada en Bitácora con campos:
  - `Entrada`, `Hábito Ref`, `Estado = ⬜ Pendiente`, `Fecha = today`
  - **`Personaje`** = page_id del personaje principal
  - **`Stat Ref`** = page_id del Stat correspondiente (mapeado vía Switch desde `habit.Stat.name`)

> ⚠️ **Si Make no setea `Personaje` y `Stat Ref`**, los rollups de XP no suman. El cron diario (`/api/cron-daily`) repara automáticamente cada noche, pero el HUD muestra XP atrasado durante el día. Configurar Make correctamente es la solución de raíz.

### Personalizar IDs de DBs
Las IDs en `api/*.js` son del workspace de referencia. Reemplazalas por las tuyas:

```javascript
const PERSONAJE_DB = 'TU_ID_AQUI';
const STATS_DB     = 'TU_ID_AQUI';
const REGISTRO_DB  = 'TU_ID_AQUI';
const MISIONES_DB  = 'TU_ID_AQUI';
const CATALOGO_DB  = 'TU_ID_AQUI';
```

> ⚠️ **Crítico**: usá el `database_id` (URL del navegador, `notion.so/{ID}`), NO el `data_source_id` (`collection://...` interno). En DBs multi-source son distintos. Ver lecciones operativas en el blueprint.

---

## 🎯 Endpoints API

| Endpoint | Método | Función | Devuelve |
|----------|--------|---------|----------|
| `/api/stats` | GET | Personaje + atributos + integridad + hogueras | `{ fisico, mente, ..., xpTotal, nivel, rango, humanidad, estadoPersonaje, hogueras, hogueras_max }` |
| `/api/registro` | GET | Hábitos del día (TZ del usuario) | `{ today, count, items[] }` con `esProhibido` flag por item |
| `/api/habit-toggle` | POST | Cambiar estado + auto-Humanidad. Acepta `useHoguera: true` para usar excepción autorizada | `{ ok, estado, humanidad, hoguera }` |
| `/api/misiones` | GET | Objetivos con progreso calculado | `{ count, misiones[] }` |
| `/api/sync-misiones` | GET | Escribe progreso de objetivos a Notion | `{ updated, failed, skipped, updates[] }` |
| `/api/repair-registros` | GET | Vincula relations faltantes (Personaje + Stat Ref). Soporta `?dry=1` para dry-run | `{ updated, skipped, errors, updates[] }` |
| `/api/dedupe-registros` | GET | Archiva duplicados de un día (`?date=YYYY-MM-DD`, default hoy). Soporta `?dry=1`. Útil tras Run once de Make o fallos que duplican entradas | `{ kept, archived, errors, keptDetails[] }` |
| `/api/cron-daily` | GET | **Endpoint del cron**: ejecuta repair → sync en orden | `{ repair, sync, duration_ms }` |
| `/api/debug` | GET | Raw JSON del personaje | Dump completo de propiedades |

### 🔄 Cron Job automático

`vercel.json` tiene configurado un cron diario a las **5:00 UTC** (~23:00 México) que ejecuta `/api/cron-daily`:
1. **repair-registros** vincula automáticamente Personaje + Stat Ref a los registros nuevos creados por Make (que no setea esas relations por defecto)
2. **sync-misiones** recalcula y escribe el Progreso de cada misión en Notion

Vercel Hobby permite hasta 2 cron jobs; este endpoint combina ambas tareas en 1.

---

## 🎲 Mecánicas RPG (resumen)

### Universal (intercambiable por tema)
- **Puntos / Nivel / Tier** — 500 puntos = 1 nivel, 8 tiers progresivos
- **5 atributos** — dimensiones del personaje (5 hábitos los alimentan)
- **Pool de Integridad** — recurso protegido (cap 0–5) que cae al fallar Hábitos Prohibidos
- **Hogueras (excepciones autorizadas)** — 4 por semana, absorben caídas en Prohibidos sin gastar Integridad. Reset automático cada lunes
- **Tipo de Hábito** — Construir (hacer) vs Evitar (dejar de hacer)
- **Frecuencia** — Diario / Semanal / Eventual
- **Veces Target** — métrica honesta para objetivos streak/count
- **Bonus por Misión Épica** — al completar una misión 💀 Épica al 100%, +1 a Humanidad (cap 5) automáticamente

### Diferenciador
A diferencia de habit trackers comunes:
- Modela formalmente **hábitos a evitar** (no solo a construir)
- Tiene un **recurso que castiga falla**, no solo recompensa éxito
- Calcula progreso **honesto** vs aspiracional (evita el "100% en 3 días" engañoso)
- Estética **intercambiable** por tema (no estás casado con Dark Souls)

---

## 📚 Documentación completa

- **[`BLUEPRINT_GAMIFICATION_NOTION.md`](./BLUEPRINT_GAMIFICATION_NOTION.md)** — Guía completa: filosofía, arquitectura, setup, 5 temas pre-diseñados, guía para crear tu tema, stack técnico, lecciones operativas y roadmap de comercialización.
- **[`BACKLOG.md`](./BACKLOG.md)** — Roadmap de features pendientes con priorización por valor real vs esfuerzo. Incluye antipatterns a evitar.
- **[`CONTEXTO_COWORK.md`](./CONTEXTO_COWORK.md)** — Contexto interno de desarrollo (IDs, decisiones, historial de bugs).

---

## 🤝 Contribuir / forkear

Este sistema está diseñado para ser **forkeable y comercializable**. La licencia permite:

- Usarlo personalmente sin restricción
- Modificarlo y distribuirlo
- **Comercializarlo** (template paid, servicio, coaching) con o sin atribución

Si lo usás como base de un producto comercial, una mención en docs/about es apreciada pero no obligatoria.

---

## ⚠️ Lecciones aprendidas durante el desarrollo

Algunas trampas de la API de Notion que te pueden ahorrar horas:

1. **`database_id` ≠ `data_source_id`** — la API de query usa el de la URL, no el `collection://` interno
2. **Multi-hop rollups bloqueados** — Notion explícitamente prohíbe rollup-of-rollup. Calcular en backend
3. **Mover una DB pierde permisos heredados** — reconectar la integration explícitamente
4. **Filtros `today` relativos no existen en API** — calcular fecha en backend con TZ explícita
5. **Embeds externos no se crean vía API** — solo embeds internos a páginas Notion
6. **Rollups a DBs en papelera devuelven `null`** — la UI muestra cache, la API no
7. **Make tiene que setear TODAS las relations** al crear pages, no solo el title — los rollups que falten devuelven 0 silenciosamente. Si "el sistema no suma XP", probablemente faltan relations en cada entrada nueva

Lista completa en [BLUEPRINT sección 9](./BLUEPRINT_GAMIFICATION_NOTION.md#9-reglas-operativas-lecciones-aprendidas).

---

## 📜 Licencia

Sin restricciones. Uso libre incluyendo comercialización.

---

**Construido por** [@frvnciscx](https://github.com/frvnciscx) · Mayo 2026  
**Inspiración estética**: la saga Dark Souls (FromSoftware)  
**Inspiración mecánica**: sistemas RPG clásicos (D&D, MMORPGs)

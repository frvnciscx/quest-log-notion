# Life Gamification System for Notion — Universal Blueprint

> Sistema de gamificación de hábitos y objetivos personales sobre Notion.  
> **Mecánica universal, estética intercambiable.**  
> Probado con tema Dark Souls; adaptable a fantasía clásica, sci-fi, jardín wholesome, minimalismo y cualquier otra temática.

**Versión**: 2.0 — Mayo 2026  
**Implementación de referencia**: github.com/frvnciscx/quest-log-notion · widgetradar.vercel.app

---

## Tabla de contenidos

1. [Filosofía del sistema](#1-filosofía-del-sistema)
2. [Mecánica universal (abstracta)](#2-mecánica-universal-abstracta)
3. [Arquitectura de datos](#3-arquitectura-de-datos)
4. [Setup en Notion paso a paso](#4-setup-en-notion-paso-a-paso)
5. [Personalización por tema](#5-personalización-por-tema)
6. [Galería de temas pre-diseñados](#6-galería-de-temas-pre-diseñados)
7. [Cómo crear tu propio tema](#7-cómo-crear-tu-propio-tema)
8. [Stack técnico opcional](#8-stack-técnico-opcional-vercel--make)
9. [Reglas operativas (lecciones)](#9-reglas-operativas-lecciones-aprendidas)
10. [Roadmap de comercialización](#10-roadmap-de-comercialización)
11. [Diferenciador vs competencia](#11-diferenciador-vs-templates-existentes)

---

## 1. Filosofía del sistema

**Lo que es:**
- Tracking honesto de hábitos y objetivos de vida
- Mecánica de juego con consecuencias reales (positivas y negativas)
- Métricas medibles que reflejan realidad, no aspiración
- Sistema que **te castiga cuando fallás**, no solo te felicita cuando cumplís

**Lo que NO es:**
- Auto-trofeo: redefinir hábitos para que "todo cuente"
- Tracking puro decorativo (anotar y nunca mirar)
- Templates estéticos sin profundidad mecánica

**Reglas operativas innegociables:**
1. Cada atributo debe tener **al menos 1 hábito activo que lo alimente**. Sin eso es decoración.
2. Cada objetivo debe tener **métrica medible** (ej: "30 días de X", "12 unidades", "100 sesiones"). Sin métrica, es aspiración.
3. **Cada feature agregada es deuda futura.** Probar 7 días antes de agregar capa nueva.
4. **No mientas.** Si un objetivo está al 100% pero solo hiciste la acción 1 vez en 30 días, hay un bug de diseño, no de motivación.

---

## 2. Mecánica universal (abstracta)

Esta mecánica es **independiente del tema**. Los nombres que aparecen acá son genéricos; cada tema los renombra (ver sección 5).

### 2.1 Sistema de Puntos / Nivel / Tier
- Hábitos completados suman **Puntos**
- Cada `N` Puntos = 1 Nivel (sugerido: N=500)
- 8 Tiers o "rangos" en escalera (Tier 1 → Tier 8)
- Cada Tier tiene un nombre temático (ver galería)

### 2.2 Atributos (5 dimensiones del usuario)
- 5 atributos representan áreas de vida que el usuario quiere desarrollar
- Por defecto: Físico / Mente / Nutrición / Hábitos / Negocio
- Personalizable: Spirit / Body / Craft / Connection / Wealth, o cualquier set
- Cada hábito alimenta 1 atributo específico

### 2.3 Tipo de Hábito (la innovación clave)
Dos categorías formales en el modelo de datos:
- **Construir** — cosas que querés HACER (ejercicio, leer, meditar)
- **Evitar** — cosas que querés DEJAR de hacer (azúcar, scroll redes, alcohol)

Para los Evitar, el lenguaje del estado se invierte:
- `✅ Cumplido` = "lo evité hoy" (positivo, suma puntos)
- `❌ No cumplido` = "caí, lo hice" (negativo, resta del **Pool de Integridad**)

### 2.4 Pool de Integridad (recurso protegido)
- Pool inicial: **5** (cap superior 5, cap inferior 0)
- **Cae −1** al fallar un hábito Evitar (sin hoguera)
- **Sube +1** al revertir un fallo / al completar misión Épica al 100% (anti-doble-conteo con flag)
- Estados visuales: Pleno (5) / Comprometido (1–4) / Drenado (0)
- En estado Drenado, los widgets cambian a paleta apagada (señal visual de urgencia)

> Esta es la mecánica diferenciadora. Le da peso emocional al sistema: cuando caés, hay consecuencia.

### 2.4b Hogueras (excepciones autorizadas)
- Pool semanal: **4** hogueras (cap)
- Reset automático: cada lunes el cron-daily las restaura a 4
- Uso: cuando vas a fallar un hábito Evitar, podés "usar hoguera" → cuesta −1 Hoguera en lugar de −1 Integridad
- Si pool=0, el flag se ignora y costó Integridad

> Filosofía: reconoce que la vida tiene excepciones legítimas (cumpleaños, viajes, eventos sociales). Permite descansar la disciplina **conscientemente y limitado**. Si gastás las 4 en una semana, las próximas caídas vuelven a costar Integridad.

### 2.5 Frecuencia de Hábitos
Resuelve el problema de hábitos no-diarios (ej: "post en redes 1×/semana"):
- **Diario** — automatización crea entrada cada mañana
- **Semanal** — usuario crea registro manualmente cuando lo hace
- **Eventual** — sin patrón fijo, manual

### 2.6 Veces Target en Objetivos
Los objetivos largos (ej: "30 días de meditación") necesitan target medible:
- `Progreso = veces_cumplidas / Veces Target × 100`
- Sin Veces Target: cálculo fallback impreciso (puede dar 100% engañoso al primer cumplimiento)
- **Recomendación universal**: definir Veces Target a TODOS los objetivos

---

## 3. Arquitectura de datos

5 DBs en Notion. Los nombres pueden traducirse al tema; aquí van los **nombres funcionales**:

```
┌─────────────────────────────────────────────────────────┐
│              📋 Catálogo de Hábitos                     │
│  Lista maestra. Valor en puntos, atributo, tipo, freq.  │
└──────────────┬──────────────────────────────┬───────────┘
               │ relation                     │ relation
               ▼                              ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│      📅 Bitácora          │     │      🎯 Objetivos         │
│  Una entrada por día x    │     │  Metas mediano/largo plz │
│  hábito. Estado: ⬜/✅/❌ │     │  Veces Target            │
└──────────┬───────────────┘     └──────────────────────────┘
           │ rollup puntos                      
           ▼                                    
┌─────────────────────────────────────────────────────────┐
│                  🧙 Personaje                            │
│  Puntos · Nivel · Tier · Integridad · Estado            │
└─────────────────────────┬───────────────────────────────┘
                          │ rollup por atributo
                          ▼
                ┌─────────────────────┐
                │     📊 Atributos    │
                │  5 dimensiones del  │
                │  personaje          │
                └─────────────────────┘
```

### 3.1 Catálogo de Hábitos
| Propiedad | Tipo | Notas |
|-----------|------|-------|
| Hábito | title | Nombre del hábito |
| Atributo | select | 5 opciones (las 5 dimensiones del usuario) |
| Categoría | select | Agrupador visual |
| Valor | number | Puntos por cumplimiento (sugerido: 10 / 15 / 20–25) |
| Activo | select | `Activo` / `Pausado` |
| Frecuencia | select | `Diario` / `Semanal` / `Eventual` |
| Tipo | select | `Construir` / `Evitar` |
| Objetivos | relation (dual) | A qué objetivos contribuye |
| Registros | relation | A las entradas de Bitácora |

### 3.2 Bitácora (Registro Diario)
| Propiedad | Tipo | Notas |
|-----------|------|-------|
| Entrada | title | Texto del hábito |
| Estado | select | `Pendiente` / `Cumplido` / `No cumplido` |
| Fecha | date | El día al que aplica |
| Hábito Ref | relation | Vincula al Catálogo |
| Personaje | relation | Al usuario (1 si single-user, varios si multi) |
| Atributo Ref | relation | A la DB Atributos |
| Valor Base | rollup | Trae Valor del Catálogo via Hábito Ref |
| Valor Ganado | formula | `if(Estado == "Cumplido", Valor Base, 0)` |

### 3.3 Personaje
| Propiedad | Tipo | Notas |
|-----------|------|-------|
| Nombre | title | Nombre del usuario o alter-ego |
| Clase | text | Descriptor opcional (ej: "Aprendiz", "Founder", "Athlete") |
| Puntos manuales (5 props) | number | Histórico inicial por atributo |
| Puntos Auto | rollup | Sum de Valor Ganado via Bitácora |
| Puntos Total | formula | Suma de manuales + auto |
| Nivel | formula | `floor(Puntos Total / 500) + 1` |
| Tier | formula | Etiqueta según nivel (8 escalones, según tema) |
| Barra | formula | Visualización con caracteres ▰▱ |
| **Integridad** | number | Default 5, cap 0–5 |
| **Estado** | formula | `if(Integridad >= 5, "Pleno", if(Integridad > 0, "Comprometido", "Drenado"))` |
| Bitácora | relation | A todos los registros |

### 3.4 Atributos (5 dimensiones)
| Propiedad | Tipo |
|-----------|------|
| Atributo | title |
| Registros | relation a Bitácora |
| Total Atributo | rollup sum de Valor Ganado |

### 3.5 Objetivos
| Propiedad | Tipo |
|-----------|------|
| Objetivo | title |
| Tipo | select: Principal / Secundario / Diario / Final |
| Categoría | select: 5 atributos + Personal |
| Estado | select: Bloqueado / Activo / En progreso / Cumplido / Abandonado |
| Dificultad | select: Fácil / Normal / Difícil / Épico |
| Recompensa | number (puntos al completarlo) |
| Progreso | number 0–100 (escrito por sync endpoint) |
| **Veces Target** | number | Target real para misiones streak/count |
| Hábitos asociados | relation dual al Catálogo |
| Fecha límite | date (opcional) |
| Notas | text |

---

## 4. Setup en Notion paso a paso

**Orden importante** (las relations requieren que ambas DBs existan primero):

1. Crear las 5 DBs vacías con sus propiedades básicas (sin relations todavía).
2. Crear las relations en este orden:
   - Catálogo ↔ Bitácora (vía `Registros` / `Hábito Ref`)
   - Personaje ↔ Bitácora (vía `Bitácora` / `Personaje`)
   - Atributos ↔ Bitácora (vía `Registros` / `Atributo Ref`)
   - **Catálogo ↔ Objetivos** (relation dual)
3. Crear las fórmulas (Valor Ganado, Puntos Total, Nivel, Tier, Barra, Estado).
4. Crear los rollups (Puntos Auto, Total Atributo, Veces Target).
5. Crear el personaje principal con `Integridad = 5`.
6. Llenar el Catálogo con 8–12 hábitos iniciales.
7. Crear vistas en Bitácora:
   - **Hoy**: filtro `Fecha is today`
   - **Default**: tabla con todas las entradas

---

## 5. Personalización por tema

La mecánica universal de la sección 2 se mantiene. Lo que cambia entre temas:

- **Naming** (cómo llamamos a Puntos, Tiers, Integridad, etc.)
- **Emojis y íconos**
- **Paleta de colores y fuentes**
- **Mensajes y taglines**

### Tabla de traducción universal

| Mecánica universal | Dark Souls | Fantasy Clásico | Sci-fi | Wholesome (Jardín) | Minimalista |
|---|---|---|---|---|---|
| Puntos | XP / Almas | Experience | Credits | Semillas | Points |
| Nivel | Nivel | Level | Tier | Floración | Level |
| Tier 1 | 💀 Iniciado | 🌱 Novato | 🛰️ Cadete | 🌱 Brote | Tier 1 |
| Tier 4 | 🛡️ Especialista | 🛡️ Caballero | 🚀 Oficial | 🌳 Árbol | Tier 4 |
| Tier 8 | 👑 Leyenda | 🐉 Legendario | 👑 Almirante | 🌲 Bosque | Master |
| Pool protegido | Humanidad | Vitalidad | Integridad | Salud del Jardín | Streak Credit |
| Estado pleno | 🪙 Humano | ❤️ Vivaz | ✅ Operativo | 🌸 Floreciendo | Active |
| Estado caído | 💀 Hueco | 💀 Drenado | ⚠️ Comprometido | 🥀 Marchito | Inactive |
| Hábito a hacer | Construir | Práctica | Misión | Plantar | Build |
| Hábito a evitar | Prohibido | Tentación | Riesgo | Plaga | Avoid |
| Objetivo | Misión | Quest | Mission | Cosecha | Goal |
| Cumplido | ✅ Completado | ✅ Hecho | ✅ Resuelto | 🌿 Crecido | ✅ Done |
| Fallado | ❌ Omitido | ❌ Fallado | ❌ Abortado | 🥀 Caído | ❌ Skipped |

---

## 6. Galería de temas pre-diseñados

### 🗡️ Tema 1: Dark Souls / Fantasía Oscura (implementación de referencia)

**Audiencia**: gamers, nostalgia souls-likes, gente que necesita un sistema "exigente"  
**Tono**: épico, sombrío, brutal-honesto

**Naming clave:**
- Puntos = XP · Pool = Humanidad · Estados = Humano / Maldito / Hueco
- Tiers: 💀 Iniciado · 🗡️ Aprendiz · 📖 Practicante · 🛡️ Especialista · 💎 Experto · 🔥 Maestro · ⚔️ Gran Maestro · 👑 Leyenda

**Paleta**: dorado hueso (`#d4c5a0`), gris ceniza, fondo transparente sobre Notion oscuro  
**Fuentes**: Playfair Display + DM Mono (o Cinzel + IM Fell English para más medieval)  
**Tagline**: *"Praise the Sun · Kindle the Ember · Link the Fire"*

---

### ⚔️ Tema 2: Fantasy Clásico (D&D / MMORPG)

**Audiencia**: jugadores de D&D, lectores de fantasía épica, RPG enthusiasts  
**Tono**: heroico, cálido, aventurero

**Naming clave:**
- Puntos = Experience · Pool = Vitalidad · Estados = Vivaz / Herido / Caído
- Tiers: 🌱 Novato · 🗡️ Aventurero · 🛡️ Caballero · 🐺 Veterano · ⚔️ Campeón · 🏰 Heroe · 🐉 Maestro · 👑 Legendario

**Paleta**: rojo borgoña (`#8b3a3a`), oro brillante (`#d4af37`), pergamino crema  
**Fuentes**: Cinzel (heroica) + Cardo (texto)  
**Tagline**: *"For honor, for glory, for the realm"*

---

### 🚀 Tema 3: Sci-fi / Cyberpunk

**Audiencia**: tech professionals, fans de Black Mirror / Cyberpunk 2077  
**Tono**: técnico, frío, eficiente

**Naming clave:**
- Puntos = Credits · Pool = Integridad · Estados = Operativo / Comprometido / Offline
- Tiers: 🛰️ Cadete · ⚙️ Técnico · 🚀 Oficial · 🛸 Ingeniero · 💻 Comandante · 🤖 Almirante · 🌌 Maestro · 👑 Singularidad

**Paleta**: cyan neón (`#00ffff`), magenta (`#ff00ff`), negro profundo  
**Fuentes**: JetBrains Mono o Space Mono (todo monoespaciado)  
**Tagline**: *"System online · Awaiting input · Excellence is metric"*

---

### 🌿 Tema 4: Wholesome / Jardín

**Audiencia**: gente burnout, mindfulness, anti-hustle culture, slow living  
**Tono**: suave, orgánico, esperanzador

**Naming clave:**
- Puntos = Semillas · Pool = Salud del Jardín · Estados = Floreciendo / Marchito / Latente
- Tiers: 🌱 Brote · 🌿 Hierba · 🌳 Árbol joven · 🌲 Árbol fuerte · 🌳 Roble · 🌸 Bosque · 🌺 Santuario · 🦋 Edén

**Paleta**: verde sage (`#9caf88`), terracota (`#c87f5b`), papel reciclado  
**Fuentes**: Lora (cálida) + Karla (sans serif suave)  
**Tagline**: *"Plantá. Regá. Esperá. El jardín crece a su tiempo"*

---

### ⬜ Tema 5: Minimalista (sin tema)

**Audiencia**: corporate, design lovers, gente que NO quiere narrativa, solo data  
**Tono**: neutro, eficiente, datos puros

**Naming clave:**
- Puntos = Points · Pool = Streak Credit · Estados = Active / Compromised / Inactive
- Tiers: T1 · T2 · T3 · T4 · T5 · T6 · T7 · T8 (literal, sin emoji)

**Paleta**: monocromática (negro / gris medio / blanco), un solo accent (azul `#0066cc`)  
**Fuentes**: Inter o IBM Plex (todo lo mismo)  
**Tagline**: ninguna o "Track. Measure. Improve."

---

## 7. Cómo crear tu propio tema

Si ninguno de los 5 te encaja, diseñá uno custom en 6 pasos:

**Paso 1 — Define el TONO en una frase**  
Ej: "Quiero un sistema que se sienta como pintar un lienzo en blanco" / "Como entrenamiento militar" / "Como cuidar un bonsái"

**Paso 2 — Elegí 8 Tiers con narrativa coherente**  
Tier 1 debe ser "principiante humilde". Tier 8 debe ser "máximo aspiracional". Los 6 del medio progresan en una historia.

**Paso 3 — Definí cómo se llama el Pool de Integridad y sus 3 estados**  
El estado caído debe sentirse como **algo que querés evitar** (no neutral). Ej: "Drenado" pesa más que "Inactive".

**Paso 4 — Elegí paleta (3 colores + 1 accent)**  
- Color de fondo (típicamente transparente)
- Color de texto principal
- Color de texto secundario  
- Color accent (botones, valores destacados)

**Paso 5 — Elegí 2 fuentes complementarias**  
- Una serif/decorativa para títulos
- Una sans/monoespaciada para datos

**Paso 6 — Tagline (opcional pero recomendado)**  
1 frase que capture el espíritu. Aparece en footer de widgets.

---

## 8. Stack técnico opcional (Vercel + Make)

> Si solo querés el template Notion, podés saltearte esta sección. Funciona sin código.

### Make automation (escenario diario)
**Trigger**: 6:00 AM zona del usuario  
**Search**: hábitos del Catálogo  
**Filter**: `Activo = ✅` AND `Frecuencia = Diario`  
**Iterator**: itera cada hábito  
**Switch/Router**: mapea `habit.Stat.name` → page_id del Stat correspondiente  
**Action — Create Data Source Item en Bitácora con TODOS estos campos**:
- `Entrada` = nombre del hábito (texto del title)
- `Hábito Ref` = page_id del hábito iterado
- `Estado` = `⬜ Pendiente`
- `Fecha` = `formatDate(now; "YYYY-MM-DD")`
- **`Personaje`** = page_id del personaje principal
- **`Stat Ref`** = page_id mapeado del Switch

> ⚠️ **Crítico**: si faltan `Personaje` o `Stat Ref` en el create, los rollups de XP no suman (devuelven 0 silenciosamente). Es el bug más común y silencioso de este sistema.

**Plan B si Make no soporta el Switch fácilmente**: implementar endpoint `/api/repair-registros` que vincule las relations a posteriori (incluido en este blueprint). Combinarlo con cron diario para auto-reparación.

### Vercel Serverless Functions
| Endpoint | Método | Función |
|----------|--------|---------|
| `/api/stats` | GET | Personaje + Atributos + Integridad + Estado |
| `/api/registro` | GET | Hábitos del día (resuelve nombres del Catálogo, filtra pausados) |
| `/api/habit-toggle` | POST | Cambia estado + auto-decremento Integridad si Evitar |
| `/api/objetivos` | GET | Progreso real cruzando 3 DBs |
| `/api/sync-objetivos` | GET/POST | Escribe Progreso a Notion (manual o cron) |
| `/api/repair-registros` | GET/POST | Vincula relations faltantes (Personaje + Stat Ref). Soporta `?dry=1` |
| `/api/dedupe-registros` | GET/POST | Archiva duplicados de un día (`?date=YYYY-MM-DD`). Mantiene la entrada más completa por hábito. Soporta `?dry=1` |
| `/api/cron-daily` | GET/POST | Combina repair + sync. Es el endpoint que llama el cron |

**Variables de entorno**: `NOTION_TOKEN` de la integration interna.

### Cron Job (vercel.json)
```json
"crons": [
  { "path": "/api/cron-daily", "schedule": "0 5 * * *" }
]
```

Vercel Hobby permite hasta 2 cron jobs; este endpoint combina **repair + sync** en 1 cron, dejando margen para agregar otro en el futuro (ej. notificaciones, backups).

### Widgets HTML embebibles
- **Dashboard de atributos** — radar chart + barras
- **HUD del personaje** — nivel, puntos, integridad
- **Check-in del día** — lista interactiva con 3 botones por hábito

Estética común: usar la paleta y fuentes del tema elegido.

---

## 9. Reglas operativas (lecciones aprendidas)

### Notion API gotchas
- **`database_id` ≠ `data_source_id`**. La API estándar usa el de la URL del navegador, no el `collection://...` interno.
- **Mover una DB pierde permisos heredados.** Reconectar la integration explícitamente.
- **Multi-hop rollups bloqueados**: error explícito `Cannot create a rollup of a related rollup property`. Calcular en backend.
- **Fórmulas con `.map()` sobre relations dan Type error vía DDL**, aunque la UI las renderiza. Calcular en backend.
- **Filtros `today` relativos no existen en API.** Calcular fecha en backend con TZ explícita (`Intl.DateTimeFormat.formatToParts`).
- **Embeds externos no se crean vía API**. Solo embeds internos a páginas Notion. Iframes externos requieren `/embed` manual.
- **Rollups que apuntan a DBs en papelera devuelven `null`** mientras la UI muestra cache.
- **Make crea pages SIN setear todas las relations** por defecto. Hay que configurarlas explícitamente en el módulo Create. **Sintoma**: rollups en 0 mientras hay datos. **Diagnóstico**: fetchear una page recién creada y mirar si tiene todas las relations llenas.

### Diseño
- **Cada atributo necesita ≥1 hábito que lo alimente**. Sino es decoración.
- **Cada objetivo necesita Veces Target** o aceptás cálculo impreciso.
- **Resolver nombres desde el Catálogo (live)**, no desde el title histórico de la Bitácora.
- **Endpoints POST que mutan datos** requieren auth si la URL puede filtrarse a terceros.

### Antipatterns que matan la motivación
- **Objetivos aspiracionales sin métrica** → quedan en 0% perpetuo y desmotivan
- **Hábitos sin marcar consistentemente** → el sistema se vuelve teatro
- **Múltiples capas sin probar** → deuda visual y mental
- **100% engañoso** (sin Veces Target) → el sistema te miente y dejás de creerle
- **Cambiar de tema cada semana** → diluye el sentido de progresión narrativa
- **Confiar en que la automatización setea todo bien** sin verificar el primer día. Hacé un fetch de una page recién creada. Si faltan relations, los rollups callan en 0 y parecerá "el sistema no funciona" cuando es solo data incompleta.
- **Hacer Run once de Make varias veces durante testing** sin limpiar — cada ejecución duplica entradas. Solución: `/api/dedupe-registros` después de cada test, o tener un Switch en Make que verifique si ya existe entrada del día antes de crear.

---

## 10. Roadmap de comercialización

### Tier 1 — MVP free (Notion template puro)
**Qué incluye:**
- Las 5 DBs configuradas con relations, fórmulas y rollups
- 1 tema preinstalado (a elección del comprador entre los 5)
- Documentación de uso
- 10 hábitos de ejemplo precargados
- 5 objetivos de ejemplo

**Distribución:** notion-template marketplaces (gumroad, notion gallery), Twitter, blog post.  
**Precio:** $0 (lead magnet) o $9 (entry point).

### Tier 2 — Pro template (USD 29–49 una vez)
**Lo de Tier 1 +:**
- **Los 5 temas listos para intercambiar** (la propuesta de valor única)
- Repo de Vercel widgets
- Setup guide de Make automation
- Onboarding en video (15–30 min)
- Soporte por email 30 días
- Guía de cómo crear tema custom

**Diferencial vs free:** el usuario puede experimentar con temas hasta encontrar el que le hace clic. Eso es defensa contra "no me gusta Dark Souls".

### Tier 3 — Servicio gestionado (USD 9–15/mes)
**Lo de Tier 2 +:**
- Hosting administrado (no requiere Vercel propio)
- Sync automático sin configurar Make
- Dashboard web fuera de Notion para reportes
- Backups y exports
- Acceso al "tema del mes" (1 tema nuevo cada 30 días)

### Tier 4 — Coaching 1-on-1 (USD 100–300/mes)
**Lo de Tier 3 +:**
- Calibración inicial del sistema
- Sesiones mensuales de revisión y ajuste de targets
- Diseño de tema custom
- Acceso prioritario a nuevas mecánicas

### Métricas de validación antes de invertir en build
- ¿Hay 50 personas pagando $29 por Tier 2 antes de invertir en Tier 3?
- ¿El churn de Tier 3 es <10% mensual?
- ¿Los usuarios que pagan **realmente lo usan diariamente**? (telemetría anónima del widget de check-in)
- ¿Cuál de los 5 temas captura más usuarios? Eso te dice si el mercado prefiere Dark Souls (gamers) o Wholesome (mindful) o Minimal (corporate).

---

## 11. Diferenciador vs templates existentes

La mayoría de "habit tracker en Notion" son:

| Templates típicos | Este sistema |
|---|---|
| Tracking puro sin mecánica | Mecánica de juego con consecuencias (Pool de Integridad) |
| XP decorativo sin fórmula real | XP via rollups + nivel/tier calculados |
| Solo "cosas que hacer" | Construir + Evitar (cubre dimensión "dejar de hacer") |
| Tablas estáticas | Widgets interactivos en vivo |
| Datos solo en Notion | API + sync bidireccional |
| Streak romántico (todo o nada) | Veces Target honesto (progreso medible) |
| Un solo "look" rígido | **5 temas intercambiables + guía para crear el tuyo** |

**6 ideas únicas que no encontrás en otros templates:**

1. **Pool de Integridad como recurso narrativo**: castiga falla en Hábitos Evitar, se recupera con disciplina. Le da peso emocional al sistema.
2. **Hábitos Evitar como tipo formal**: los demás templates te hacen escribir "Sin azúcar" como hábito normal y te confunden con la lógica al revés. Aquí está formalizado en el modelo de datos.
3. **Hogueras (excepciones autorizadas)**: 4 por semana, absorben caídas legítimas (cumpleaños, vacaciones) sin destruir tu Integridad. Reconoce que la vida tiene matices — la mayoría de templates te castigan rígidamente por contextos sociales normales. Reset automático cada lunes.
4. **Honestidad numérica**: el cálculo `Veces Target` evita el "100% en 3 días" engañoso de otros sistemas.
5. **Estética intercambiable**: 5 temas pre-diseñados + guía para tu propio tema. La mecánica es universal, la narrativa la elegís vos.
6. **Auto-reparación + dedupe**: cualquier sistema con automatización (Make/Zapier/n8n) tarde o temprano genera entradas incompletas o duplicadas. Este blueprint incluye `/api/repair-registros` + `/api/dedupe-registros` + `/api/cron-daily` como endpoints de mantenimiento. Ningún template Notion en el mercado los tiene.
7. **Bonus por Misión Épica**: al completar una misión de Dificultad Épica al 100%, el sistema suma automáticamente +1 a Humanidad (con anti-doble-conteo). Recompensa narrativa proporcional al esfuerzo.

---

## Apéndice: Snippets de código clave

### Filtro Make
```
Activo = ✅  AND  Frecuencia = Diario
```

### Fórmula `Valor Ganado` (Bitácora)
```javascript
if(prop("Estado") == "Cumplido", prop("Valor Base"), 0)
```

### Fórmula `Estado` (Personaje)
```javascript
if(prop("Integridad") >= 5, "Pleno",
  if(prop("Integridad") > 0, "Comprometido", "Drenado"))
```

### Fórmula `Barra` de Puntos (Personaje)
```javascript
let(p, prop("Puntos Total"), lvl, floor(p / 500), cur, p - (lvl * 500),
  "Nv." + format(lvl + 1) + " " +
  "▰".repeat(floor(cur / 50)) +
  "▱".repeat(10 - floor(cur / 50)) +
  " " + format(cur) + "/500")
```

### Cálculo de progreso (backend)
```javascript
const progresoFinal = vecesTarget > 0
  ? Math.min(100, Math.round((completadosTotal / vecesTarget) * 100))
  : Math.min(100, Math.round((puntosAcumulado / xpTargetRound) * 100));
```

---

## Licencia y atribución

Este blueprint está bajo **CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial).

✅ **Permitido sin permiso explícito**:
- Implementarlo en tu Notion personal
- Modificarlo para tu uso individual
- Compartir el blueprint con atribución
- Usar el código de referencia (MIT) para tus integraciones

❌ **Requiere licencia comercial**:
- Vender templates basados en este blueprint
- Construir SaaS / app pagada usando esta documentación
- Incluirlo en cursos pagados o coaching comercial
- Cualquier uso comercial directo o indirecto

**Para licencia comercial**, contactar por:
- **Email**: contacto.fxv@gmail.com
- **GitHub Issue**: [github.com/frvnciscx/quest-log-notion/issues](https://github.com/frvnciscx/quest-log-notion/issues) con título `[Commercial License]`

Términos razonables disponibles para emprendedores y creators.

**Atribución sugerida**:
> Based on Quest Log Gamification System by Francisco Vázquez  
> github.com/frvnciscx/quest-log-notion

**Implementación de referencia**: github.com/frvnciscx/quest-log-notion  
**Versión 2.0** — Mayo 2026 (refactor multi-tema)

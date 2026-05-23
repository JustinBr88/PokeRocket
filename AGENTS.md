# AGENTS.md - Pokémon Unova Arena

## Estado del Proyecto

**Fase 0 ✅ — Completada:** Scaffold + Docker Compose + Backend (Bun+Hono+Mongoose) + Frontend (Vite+React Router DOM) + AGENTS.md

**Fase 1 ✅ — Completada:** Title Screen, Login (Clerk), Home Menu, Play/Room/Teams/Battle/Results/Leaderboards/History

**Fase 2 ✅ — Completada:** Import PokéAPI (300 Pokémon, moves, tipos)

**Fase 3 ✅ — Completada:** Sistema de roles + 12 ataques seleccionables por Pokémon (el usuario elige 4 para usar en batalla)

**Fase 4 ✅ — Completada:** Lobby con chat en tiempo real + sync de READY entre jugadores + WS reconnect

**Fase 5 ✅ — Completada:** Sistema de música por pantalla (bucle) + sonidos de ataques en batalla

**Fase 6 ✅ — Completada:** Battle Screen UI + animaciones

---

## **SISTEMA PREMIUM CON STRIPE** (NUEVA PRIORIDAD)

**Fase 7 ✅ — Completada:** Setup Stripe + Página de Pago ($14.99 one-time)
  - ✅ Backend: Endpoints `/api/payments/intent`, `/api/payments/confirm`, webhook `/api/stripe-webhook`
  - ✅ Frontend: Página `/premium` con formulario Stripe Elements
  - ✅ Sidebar: Botón Premium con estado dinámico (Premium / Premium (Active))
  - ✅ DB: User extendido con `isPremium`, `premiumPurchasedAt`, `stripeCustomerId`, `stripePaymentIntentId`
  - ✅ `stripeService.ts` con métodos createPaymentIntent, confirmPaymentIntent
  - ✅ Webhook signature verification con Stripe SDK
  - ✅ Variables .env configuradas

**Fase 8 ✅ — Completada:** Sistema Shiny en Batalla
  - ✅ Backend: `BattlePokemon.pokemonId` es `Number` (pokedexId, no ObjectId)
  - ✅ Backend: Team Model con campo `shinyEnabled: { type: Boolean, default: false }`
  - ✅ Backend: `startBattle()` extrae `shinyEnabled` de cada equipo y lo guarda en `BattleModel` (array por posición)
  - ✅ Backend: `buildBattlePokemon()` usa `pokemonDoc.pokedexId` (no `_id`)
  - ✅ Backend: `PlayerStateSchema` tiene `shinyEnabled: [Boolean]` para persistir preferencia en batalla
  - ✅ Frontend: `toggleShiny(pokemonId)` en teamStore (Zustand)
  - ✅ Frontend: Teams.tsx — botón SHINY dorado en header (muestra/oculta según premium)
  - ✅ Frontend: Teams.tsx — toggle shiny por Pokémon en "Current Team" (★)
  - ✅ Frontend: Teams.tsx — botón ADD TO TEAM se bloquea con "YA TIENES UN LEGENDARIO" o "EN EQUIPO"
  - ✅ Frontend: `getActiveSpriteUrl(pokemon, isPlayer, playerSide)` muestra shiny según preferencia guardada
  - ✅ Frontend: Sprites shiny de Showdown Gen 5 animados (`ani-shiny/` / `ani-back-shiny/`)

  **Lógica Premium para Shiny:**
  - **Premium = puede USAR shiny:** el botón ★ aparece en Teams y pueden activar shiny en sus Pokémon
  - **No Premium = solo puede VER shiny:** si un rival tiene premium y activó shiny, el no-premium lo ve igual
  - El que tiene premium y activa shiny → TODOS en la batalla ven la versión shiny de ese Pokémon
  - El que no tiene premium NO ve el botón para activar shiny, solo puede ver los de los premium

**Fase 9 ✅ — Completada:** Música Premium en Batalla (random entre 3 canciones)
  - ✅ Backend: Función `selectBattleMusic(battleMode, hasAnyPremium)` en battleEngine.ts
  - ✅ Backend: Verificación `isPremium` de ambos jugadores antes de startBattle()
  - ✅ Backend: broadcast BATTLE_STARTED incluye `selectedBattleMusic` + `premiumInfo`
  - ✅ Frontend: WsMessage tipo `BATTLE_STARTED` con `selectedBattleMusic?: string`
  - ✅ Frontend: MusicProvider captura `selectedBattleMusic` del WS message
  - ✅ Frontend: MusicProvider reproduce track seleccionado (300ms fade)

---

## **GAMEPLAY FUTURO** (BACKLOG)

**Fase 10 🔲 — Pendiente:** Draft Mode (Ranked: bans + picks)

**Fase 11 🔲 — Pendiente:** Post-Draft (elegir moves/ability)

**Fase 12 🔲 — Pendiente:** Results + Battle History real

**Fase 13 🔲 — Pendiente:** Ranked ELO + Leaderboards real

---

## Tech Stack

| Capa | Herramienta |
|------|-------------|
| Frontend | Vite 5 + React 18 + React Router DOM v7, TypeScript, Tailwind CSS |
| State | TanStack Query v5 + Zustand |
| Backend | Bun + Hono |
| DB | MongoDB (Mongoose) — via Docker Compose |
| Auth | Clerk (@clerk/clerk-react) |
| Realtime | Bun WebSocket nativo |
| Sprites | Pokémon Showdown animated GIFs (primary) + PokeAPI (fallback) |

---

## Estructura del Proyecto

```
pokefighter/
├── docker-compose.yml          # MongoDB + backend
├── Dockerfile                  # Backend container
├── package.json               # Scripts raíz: dev, import, build
├── backend/
│   ├── src/
│   │   ├── index.ts           # Hono app + Bun server export
│   │   ├── db.ts              # Mongoose connect
│   │   ├── models/index.ts    # Todos los modelos Mongoose
│   │   ├── routes/
│   │   │   ├── rooms.ts       # CRUD de salas
│   │   │   ├── battle.ts      # Acciones de batalla
│   │   │   ├── pokemon.ts     # Búsqueda de Pokémon
│   │   │   ├── auth.ts        # Clerk webhook + user lookup
│   │   │   └── ws.ts         # WebSocket upgrade
│   │   ├── services/
│   │   │   └── battleEngine.ts # Daño, tipos, status, turn resolver
│   │   ├── ws/
│   │   │   └── roomRegistry.ts  # Room client registry + broadcast
│   │   └── scripts/
│   │       └── importFromPokeAPI.ts  # Seed: 300 Pokémon
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/
    ├── index.html              # Entry HTML (Vite)
    ├── vite.config.ts          # Vite config
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.cjs
    ├── tsconfig.json
    ├── .env                    # VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL, VITE_WS_URL
    └── src/
        ├── main.tsx            # Entry point (ClerkProvider + QueryClientProvider + BrowserRouter)
        ├── App.tsx             # Routes definitions (Routes + Route)
        ├── app/
        │   └── index.css        # Design tokens, animaciones CSS
        └── routes/
            ├── title.tsx       # Title Screen (/)
            ├── login.tsx       # Login Clerk (/login)
            ├── home.tsx        # Home Menu (/home) — sidebar con Pokédex, Rules, etc.
            ├── play.tsx        # Play mode select (/play)
            ├── room.tsx        # Lobby (/room/:roomId)
            ├── teams.tsx       # Team Builder (/teams/:roomId)
            ├── battle.tsx      # Battle Screen (/battle/:roomId) — SIN back button
            ├── results.tsx     # Results (/results/:roomId)
            ├── leaderboards.tsx # Leaderboards (/leaderboards)
            ├── history.tsx     # Battle History (/history)
            ├── rules.tsx       # Rules — guía breve del juego (/rules)
            └── pokedex.tsx     # Pokédex — ver 300 Pokémon con stats/moves (/pokedex)
        ├── lib/
        │   ├── sprites.ts      # getFrontSprite, getBackSprite, hpColor
        │   ├── poke-api.ts     # API client functions (searchPokemon, getPokemon)
        │   └── useBattleSocket.ts  # WS hook con reconnect
        ├── stores/
        │   └── teamStore.ts    # Zustand: equipo en construcción
        └── types/
            └── index.ts        # WsMessage, BattleState, PokemonAPI, etc.
```

---

## Flujo de Pantallas

```
/ (Title) → /login (Clerk) → /home (Menú)
  → /play (Ranked o Casual)
    → /room/[roomId] (Lobby)
      → /teams/[roomId] (Team Builder — ambos eligen 6 Pokémon)
        → /battle/[roomId] (Combate) — SIN botón volver (confirmado)
          → /results/[roomId]
```

**Navegación standalone** (accessible desde sidebar sin contexto):
- `/leaderboards` — Ver ranking de jugadores
- `/history` — Historial de batallas propias
- `/rules` — Guía breve del juego
- `/pokedex` — Catálogo de los 300 Pokémon disponibles

---

## Reglas de Navegación — Botón "Volver"

**Patrón:** Cada página que tiene un flujo específico (no es standalone) debe tener un botón volver en la esquina superior izquierda del header.

**Formato del botón:** SOLO icono `arrow_back`, sin texto.

```tsx
<button
  onClick={() => navigate('/[destino]')}
  className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
  aria-label="Volver a home"
>
  <span className="material-symbols-outlined">arrow_back</span>
</button>
```

**Ubicación:** En el header, pegado a la izquierda antes del título.

**Páginas que NECESITAN botón volver:**

| Página | Destino del botón |
|--------|-------------------|
| `/play` | HOME |
| `/room/:roomId` | HOME |
| `/leaderboards` | HOME |
| `/history` | HOME |
| `/results/:roomId` | HOME |

**Páginas que NO necesitan botón volver:**
- `/home` — Es el homepage, punto de entrada
- `/title` — Landing page
- `/login` — Flujo de auth, redirige solo
- `/battle/:roomId` — En combate no se puede volver atrás (confirmado)
- `/pokedex` — standalone, accesible desde sidebar
- `/rules` — standalone, accesible desde sidebar
- `/teams/:roomId` — Tiene botón CANCEL que lleva a HOME

---

## Sidebar — Items de Navegación

El sidebar en `/home` tiene los siguientes items:

| Icono | Label | Ruta | Notas |
|-------|-------|------|-------|
| `home` | Home | `/home` | activo (borde izquierdo primary) |
| `menu_book` | **Pokédex** | `/pokedex` | Reemplaza PC Box |
| `inventory_2` | History | `/history` | — |
| `menu` | **Rules** | `/rules` | Reemplaza Settings |
| — | ~~Trade~~ | **ELIMINADO** | No está en el scope del proyecto |

---

## Comandos de Desarrollo

```bash
# Levantar TODO (MongoDB + backend + frontend) — un comando
npm run dev

# Levantar solo backend (precisa MongoDB corriendo)
npm run dev:backend

# Levantar solo frontend (Vite, puerto 3000)
npm run dev:frontend

# Solo MongoDB (via Docker)
npm run db:start    # docker compose up -d
npm run db:stop     # docker compose stop
npm run db:clean    # docker compose down -v

# Importar 300 Pokémon desde PokéAPI (~20 moves por Pokémon)
npm run import

# Generar movesets (12 attacks + 4 famous por Pokémon)
npm run generate-movesets

# Build producción backend
npm run build
```

---

## Sprites — Fuente y Uso

**Strategy:** Pokémon Showdown animated GIFs (Gen 5 pixel art).

```typescript
// src/lib/sprites.ts
function toShowdownName(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-')
    .replace(/\./g, '');
}

function getFrontSprite(name: string) {
  return `https://play.pokemonshowdown.com/sprites/ani/${toShowdownName(name)}.gif`;
}

function getBackSprite(name: string) {
  return `https://play.pokemonshowdown.com/sprites/ani-back/${toShowdownName(name)}.gif`;
}
```

**Fallback (onError):** Usar `spriteUrl` de MongoDB (PokéAPI static).

**Regla visual:** `image-rendering: pixelated` en todos los sprites.

---

## Modelos de Datos (MongoDB)

**User** — sync via Clerk webhook
```typescript
{ odiserId: string, username, avatarUrl, elo: 1500, wins: 0, losses: 0 }
```

**Pokemon** — cache PokéAPI (300+)
```typescript
{ pokedexId, name, types[], baseStats, spriteUrl, moveIds[], isLegendary, isMythical, generation, role }
// moveIds: array de ~20 moveIds (todos los movimientos disponibles del Pokémon en PokéAPI)
```

**Role** — auto-detectado según comportamiento del Pokémon
```typescript
role: 'Fisico' | 'Especial' | 'Tanque' | 'Asesino' | 'Soporte' | 'Mixto'
```

| Rol | Criterio de detección |
|-----|----------------------|
| **Fisico** | 2+ physical moves con power > 70, sin setup/curación |
| **Especial** | 2+ special moves con power > 70, sin setup/curación |
| **Mixto** | 2+ setup moves (Swords Dance, Dragon Dance, etc.) |
| **Soporte** | Tiene move de curación (healing > 0 ó drain > 0) |
| **Asesino** | 2+ moves que aplican estado (burn, toxic, paralysis, etc.) |
| **Tanque** | HP > 90 && Defense > 85, sin ser sweep puro |

**Moveset** — 12 ataques seleccionables por Pokémon (el usuario elige 4 para usar en batalla)
```typescript
{
  pokemonId: number,
  pokemonName: string,
  role: Role,
  moves: [{
    moveId: number,
    moveName: string,
    type: string,
    power: number | null,
    accuracy: number | null,
    damageClass: 'physical' | 'special' | 'status',
    priority: number,
    category: 'damage' | 'healing' | 'setup' | 'ailment' | 'debuff',
    soundPath: string | null,  // "sonidos/Attack Moves/Thunderbolt.mp3"
    famous: boolean,           // true = uno de los 4 movimientos destacados
  }]
}
```

**Flujo de importación:**
1. `npm run import` → importa ~20 moves por Pokémon a `Pokemon.moveIds`
2. `npm run generate-movesets` → selecciona 12 diversos, marca 4 como `famous: true`

**Move**
```typescript
{ pokeApiId, name, type, power, accuracy, priority, damageClass, effect, meta }
```

**Meta** (embedded in Move for classification)
```typescript
{ category: 'damage' | 'damage-ailment' | 'net-good-stats' | 'net-poor-stats' | 'heal' | 'field-effect' | ..., healing: number, drain: number, ailment: string, statChanges: [] }
```

**TypeRelation**
```typescript
{ attackingType, doubleDamageTo[], halfDamageTo[], noDamageTo[] }
```

**Room**
```typescript
{ code, mode, status, players: [{odiserId, name, side, ready}], bans, picks }
```

**Battle** — estado en MongoDB
```typescript
{ roomCode, turn, status, players, battleLog, winnerUserId }
```

**Team** — guardado (Casual)
```typescript
{ odiserId, name, pokemons: [{pokemonId, ability, moves: number[], shiny}] }
```

**BattleHistory**
```typescript
{ roomCode, players, winnerUserId, turnCount, mode }
```

---

## WebSocket Events

**Client → Server:** Actions van por REST `POST /api/battle/:roomCode/action`.
**WS Server → Client (push only):**

```
PLAYER_CONNECTED, PLAYER_DISCONNECTED,
PLAYER_READY, LOBBY_READY,
BATTLE_STARTED,
TURN_RESOLVED (con BattleState completo),
BATTLE_ENDED (con winnerUserId)
```

---

## Battle Engine (Backend)

- **Nivel 50.** IV random 0-31 por stat.
- **HP:** `floor(((2*base+iv)*50)/100)+50+10`
- **Stats:** `floor(((2*base+iv)*50)/100)+5`
- **Daño:** Gen 5 style — `floor((2*LEVEL/5+2)*power*atk/def/50)+2` × modifiers
- **Modifiers:** random(0.85-1.0) × STAB(1.5) × type_eff × critical(1.5) × burn(0.5)
- **Critical:** 1/24 chance
- **Status:** burn/poison = 6.25% HP/turn; paralysis = speed halved; duran 3 turnos, se borran al switch
- **Orden:** move priority → effective speed → coin flip

---

## Move Classification System (Fase 3)

### Move Categories

Cada move en PokéAPI tiene metadata para clasificación:

| Campo | Descripción |
|-------|-------------|
| `meta.category` | 'damage', 'damage-ailment', 'net-good-stats', 'net-poor-stats', 'heal', 'field-effect' |
| `meta.healing` | Cantidad de curación directa (Soft-Boiled = 50) |
| `meta.drain` | % del daño infligido que se cura (Absorb = 50) |
| `meta.ailment` | 'burn', 'paralysis', 'toxic', 'freeze', 'sleep', 'none' |
| `meta.statChanges` | [{ stat, change }] para setup/ Debuff moves |
| `target.name` | 'selected-pokemon', 'opponents-field', 'all-opponents' |

### Clasificación de Moves

```typescript
// Non-damaging status move
isStatus = damageClass === 'status' || power === null

// Healing move (direct heal o drain)
isHealing = meta.healing > 0 || meta.drain > 0

// Setup/Buff move (stat increases)
isSetup = statChanges.some(s => s.change > 0)

// Ailment move (applies status condition)
isAilment = ailment !== 'none'

// Field move (affects battlefield) — EXCLUIDOS del import
isField = meta.category === 'field-effect' || target.name.includes('field')

// Debuff move (lowers enemy stats)
isDebuff = statChanges.some(s => s.change < 0)

// Damaging move
isDamaging = power !== null && damageClass !== 'status'
```

### Field Moves — EXCLUIDOS

Moves que afectan el campo y NO se incluyen en los 12 ataques seleccionables:

```
Stealth Rock, Spikes, Toxic Spikes, Reflect, Light Screen,
Tailwind, Trick Room, Gravity, Wonder Room, Magic Room,
Sunny Day, Rain Dance, Sandstorm, Hail, Snowscape,
Aurora Veil, Defog, Rapid Spin, Court Change, Terrain moves
(Grassy Terrain, Electric Terrain, Psychic Terrain, Misty Terrain)
```

### Selección de 12 Ataques Seleccionables

1. **Filtrar** todos los field moves
2. **Clasificar** por categoría: healing > setup > ailment > debuff > damaging
3. **Seleccionar hasta 12** priorizando diversidad:
   - 2 healing (si hay)
   - 2 setup (si hay)
   - 2 ailment (si hay)
   - 2 debuff (si hay)
   - 4 damaging (ordenados por accuracy * power)

Prioridad de categorías: `healing > setup > ailment > debuff > damaging`

---

## Sistema de Música y Sonidos

### Archivos de Audio

**Música por pantalla (bucle, una canción por pantalla):**

| Archivo | Pantalla | Notas |
|---------|----------|-------|
| `Musica_Titulo.mp3` | `/title` | Pantalla de título |
| `Musica_Home.mp3` | `/home` | Menú principal |
| `Musica_Lobby.mp3` | `/room/:roomId`, `/play`, `/teams/:roomId` | Lobby, sala de espera y Team Builder |
| `Musica_Pokedex.mp3` | `/pokedex` | Pokédex |
| `Batalla_Casual.mp3` | `/battle/:roomId` (modo casual) | Pantalla de batalla |
| `Batalla_Ranked.mp3` | `/battle/:roomId` (modo ranked) | Pantalla de batalla |
| `Victoria_Casual.mp3` | `/results/:roomId` (victoria casual) | Resultados |
| `Derrota_Casual.mp3` | `/results/:roomId` (derrota casual) | Resultados |
| `Victoria_Ranked.mp3` | `/results/:roomId` (victoria ranked) | Resultados |
| `Derrota_Ranked.mp3` | `/results/:roomId` (derrota ranked) | Resultados |

**Música Premium** (para futura función de pago — versión shiny + 3 músicas extras):
- `Batalla_Premium1.mp3`
- `Batalla_Premium2.mp3`
- `Batalla_Premium3.mp3`

**Sonidos de ataques:** `sonidos/Attack Moves/{moveName}.mp3` — 619 archivos de audio de movimientos.

### Movesets (12 ataques por Pokémon)

Los 12 ataques seleccionables están guardados en MongoDB (modelo `Moveset`). Estructura de la carpeta `movesets/` (metadata JSON, NO archivos de audio):

```
movesets/
├── 001_Bulbasaur.json   # { pokemonId, pokemonName, role, moves: [...] }
├── 002_Ivysaur.json
└── ...
```

---

## Role Detection System (Fase 3)

### Roles Disponibles

| Rol | Descripción | Criterio principal |
|-----|-------------|-------------------|
| **Fisico** | Daño físico puro (DPS) | 2+ physical moves con power > 70, sin setup/curación |
| **Especial** | Daño especial puro (DPS) | 2+ special moves con power > 70, sin setup/curación |
| **Mixto** | Se buffea a sí mismo | 2+ setup moves (Swords Dance, Dragon Dance, etc.) |
| **Soporte** | Curación y utilidad | Tiene move de curación (healing > 0 ó drain > 0) |
| **Asesino** | Aplica estados | 2+ moves que aplican ailment (burn, toxic, etc.) |
| **Tanque** | Alta defensa/HP | HP > 90 && Defense > 85, sin ser sweep puro |

### Algoritmo de Detección (orden de prioridad)

```typescript
function detectRole(pokemon: PokemonData): Role {
  const moves = pokemon.moves;

  // 1. Soporte — prioriza curación
  if (moves.some(m => m.meta.healing > 0 || m.meta.drain > 0)) return 'Soporte';

  // 2. Mixto — prioriza setup moves
  const setupMoves = moves.filter(m => m.statChanges?.some(s => s.change > 0));
  if (setupMoves.length >= 2) return 'Mixto';

  // 3. Asesino — prioriza moves de estado
  const ailmentMoves = moves.filter(m => m.meta.ailment !== 'none');
  if (ailmentMoves.length >= 2) return 'Asesino';

  // 4. Tanque — stats defensivos altos
  if (pokemon.baseStats.hp > 90 && pokemon.baseStats.defense > 85) return 'Tanque';

  // 5. Fisico — physical moves con power > 70
  const physicalMoves = moves.filter(m => m.damageClass === 'physical' && m.power > 70);
  if (physicalMoves.length >= 2) return 'Fisico';

  // 6. Especial — special moves con power > 70
  const specialMoves = moves.filter(m => m.damageClass === 'special' && m.power > 70);
  if (specialMoves.length >= 2) return 'Especial';

  // Default — fallback a Mixto
  return 'Mixto';
}
```

**Nota sobre el flujo de roles:**
- `npm run import` → guarda Pokémon con rol temporal (old enum en console log, pero NO se persiste en DB)
- `npm run generate-movesets` → detecta rol CORRECTO con los criterios nuevos y actualiza tanto `Moveset` como `Pokemon.role`
- El rol correcto en `Pokemon.role` solo existe después de ejecutar ambos scripts

---

## Design System (CSS)

Ver `DESIGN.md` para tokens completos. Claves para agents:

- **3px border-width** en todos los containers
- **Chamfer cuts:** `clip-path: polygon(...)` en botones de alta prioridad
- **Fonts:** Space Mono (headlines), JetBrains Mono (body/data)
- **CRT overlay:** scanlines fixed en `z-999`
- **HP bar colors:** verde >50%, amarillo 25-50%, rojo <25%
- **Material Symbols** para iconos (`font-variation-settings: 'FILL' 1` para filled)
- **Overflow en body:** Usar `overflow-x: hidden` en `index.css`, NO `overflow: hidden` — permite scroll vertical

**Animaciones CSS** (definidas en `frontend/src/app/index.css`):
- `.anim-attack`, `.anim-damage`, `.anim-faint`, `.anim-enter-player`, `.anim-enter-opponent`
- `.pokeball-spin` — para loading states

---

## Responsive — Reglas de layout

### Viewport base: 1440×900 (100% zoom)
Todo contenido debe caber en este viewport SIN scroll horizontal y SIN zoom out. Si el contenido excede, ajustar padding/gaps/botones, no zoom.

### Sistema de espaciado estándar (para TODAS las páginas)

| Elemento | Clase Tailwind | Valor px | Notas |
|----------|---------------|----------|-------|
| **Header** | `h-16 p-4` | 64px altura, 16px padding | Fixed top, z-50 |
| **Sidebar** | `w-64` | 256px ancho | Fixed left, h-[calc(100vh-64px)] |
| **Botones bento** | `h-20` | 80px | Alternativa: `h-24` (96px) si hay espacio |
| **Botones primarios (Play)** | `h-40` | 160px | Solo para 1-2 botones en página |
| **Card padding** | `p-3` | 12px | Móvil. Desktop: `md:p-4` (16px) |
| **Gaps entre cards** | `gap-2` | 8px | Móvil. Desktop: `md:gap-3` (12px) |
| **Padding contenido** | `p-4` | 16px | Móvil. `md:p-6` (24px) para páginas con poco contenido |
| **Scroll page padding** | `pt-16 pb-4` | 64px top, 16px bottom | Compensa header fijo |
| **Footer stats** | `mt-4 p-2 md:p-3` | 16px margin, 8-12px padding | Compacto |

### Home Page (bento grid)
```tsx
// Grid de 5 botones (2+1+2)
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  <button className="h-20 ...sm:col-span-2">Team Builder</button>
</div>

// Footer stats compacto
<div className="mt-4 bg-surface-container border-4 border-black p-2 md:p-3 chamfer-both">
  <div className="flex flex-col sm:flex-row justify-between items-center gap-2 md:gap-4">
    {/* Season info + Wins/Loss boxes */}
  </div>
</div>
```

### Battle Page
- Sprites: `w-28 h-28 md:w-40 md:h-40` (112px / 160px)
- HP bars: NO usar `transform: skewX` — complica responsive
- Move buttons: `grid-cols-2 gap-2 p-3`
- Team footer: `h-auto md:h-32`

---

## Construcción de Nuevas Páginas

### Patrón de layout obligatorio

```tsx
<div className="min-h-screen bg-background font-body flex flex-col">
  <div className="crt-overlay" />
  
  {/* Header sticky */}
  <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4 sticky top-0 z-50">
    <button onClick={() => navigate('/home')}>
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
    <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">TITLE</h1>
  </header>

  {/* Main con scroll si hay mucho contenido */}
  <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto pb-8 overflow-y-auto">
    {/* Contenido */}
  </main>
</div>
```

### Reglas de overflow

| Situación | Solución |
|-----------|----------|
| Body `overflow: hidden` en `index.css` | Cambiar a `overflow-x: hidden` — permitir scroll vertical |
| Contenedor muy alto + contenido overflow | NO usar `height: 100vh` + `overflow: hidden` simultáneamente |
| Página con mucho contenido | `main` con `overflow-y-auto` y `flex-1` |
| Página con poco contenido | `main` con padding normal, sin overflow forzado |

### Botón "Volver" — Formato actual

```tsx
<button
  onClick={() => navigate('/home')}
  className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
  aria-label="Volver a home"
>
  <span className="material-symbols-outlined">arrow_back</span>
</button>
```

**SOLO icono, sin texto.** Ubicado en header, pegado a la izquierda antes del título.

---

## Páginas Nuevas — Especificación

### `/rules` (Rules Page) — ✅ Implementada
- Reemplaza "Settings" en sidebar
- Header con título "RULES" y botón volver (solo icono `arrow_back`)
- Contenido: guía breve del sistema de combate, tipos de partida (Casual vs Ranked), cómo subir de rango
- Layout: header sticky + main con `flex-1 overflow-y-auto` para scroll
- Background: hex-pattern consistente con la app

### `/pokedex` (Pokédex Page)
- Reemplaza "PC Box" en sidebar
- Grid de 300 Pokémon (grid-cols-4 a grid-cols-6 según viewport)
- Cada card muestra: sprite, nombre, tipos, número de Pokédex
- Click en card → abre panel lateral (derecha) con:
  - Sprite grande
  - Nombre completo + tipos
  - Stats completos (HP, Attack, Defense, Sp.Atk, Sp.Def, Speed)
  - **12 ataques disponibles** (nombre, tipo, poder, accuracy, damage class)
  - **4 ataques destacados** con badge dorado (`famous: true`)
  - **Rol detectado** (Fisico, Especial, Tanque, Asesino, Soporte, Mixto)
  - Indicador si es legendary/mythical
  - Icono de speaker si el ataque tiene sonido disponible (`sonidos/Attack Moves/{moveName}.mp3`)
- Filtro por nombre (search input) y por tipo (dropdown)
- Endpoint usado: `GET /api/movesets` (devuelve todos los movesets con sus 12 attacks + 4 famous)
- NO tiene botón volver — es standalone desde sidebar

---

## Referencias

- `.agents/pokemon-backend/SKILL.md` — battle engine completo
- `.agents/pokemon-frontend/SKILL.md` — Gen 5 UI patterns
- `.agents/pokemon-websocket/SKILL.md` — WS room registry
- `.agents/clerk-auth-patterns/SKILL.md` — Clerk + MongoDB sync
- `DESIGN.md` — sistema visual (colores, tipografía, componentes)
- `Instucciones_del_Proyecto.md` — requisitos del curso
- `wireframe/*.html` — layouts visuales completos
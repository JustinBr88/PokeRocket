# Pokémon Unova Arena

Un battle PvP Pokémon completo con sistema de combate por turnos al estilo Gen 5, lobby multiplayer en tiempo real, y sistema premium con Stripe.

---

## 🚀 Quick Start

```bash
# 1. Levantar MongoDB (Docker)
npm run db:start

# 2. En otra terminal, levantar backend
npm run dev:backend

# 3. En otra terminal, levantar frontend
npm run dev:frontend
```

El frontend corre en `http://localhost:3000` y el backend en `http://localhost:3001`.

---

## 🏗️ Arquitectura

### Tech Stack

| Capa | Herramienta |
|------|-------------|
| **Frontend** | Vite 5 + React 18 + React Router DOM v7, TypeScript, Tailwind CSS |
| **State** | TanStack Query v5 + Zustand |
| **Backend** | Bun + Hono |
| **DB** | MongoDB (Mongoose) — via Docker Compose |
| **Auth** | Clerk (@clerk/clerk-react) |
| **Realtime** | Bun WebSocket nativo |
| **Sprites** | Pokémon Showdown animated GIFs (primary) + PokeAPI (fallback) |
| **Payments** | Stripe (Checkout + Webhooks) |

### Estructura del Proyecto

```
poke rocket/
├── docker-compose.yml          # MongoDB container
├── Dockerfile                  # Backend container (production)
├── package.json               # Scripts raíz
├── AGENTS.md                   # Documentación técnica completa
├── DESIGN.md                   # Sistema de diseño (colores, fuentes, componentes)
│
├── backend/
│   ├── src/
│   │   ├── index.ts           # Hono app + Bun server
│   │   ├── db.ts              # Mongoose connect
│   │   ├── models/            # User, Pokemon, Move, Moveset, Room, Battle, Team, etc.
│   │   ├── routes/
│   │   │   ├── rooms.ts       # CRUD de salas
│   │   │   ├── battle.ts      # Acciones de batalla
│   │   │   ├── pokemon.ts     # Búsqueda de Pokémon
│   │   │   ├── auth.ts        # Clerk webhook + user lookup
│   │   │   ├── payments.ts   # Stripe payment intents + webhooks
│   │   │   └── ws.ts         # WebSocket upgrade
│   │   ├── services/
│   │   │   └── battleEngine.ts # Daño, tipos, status, turn resolver
│   │   ├── ws/
│   │   │   └── roomRegistry.ts  # Room client registry + broadcast
│   │   └── scripts/
│   │       └── importFromPokeAPI.ts  # Seed: 300 Pokémon + moves
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx            # Entry point (ClerkProvider + QueryClientProvider)
    │   ├── App.tsx             # Routes definitions
    │   ├── app/
    │   │   └── index.css        # Design tokens, animaciones CSS, CRT overlay
    │   ├── routes/
    │   │   ├── title.tsx       # Pantalla de título (/)
    │   │   ├── login.tsx       # Login Clerk (/login)
    │   │   ├── home.tsx        # Menú principal (/home)
    │   │   ├── play.tsx        # Seleccionar modo (/play)
    │   │   ├── room.tsx        # Lobby multiplayer (/room/:roomId)
    │   │   ├── teams.tsx       # Team Builder (/teams/:roomId)
    │   │   ├── battle.tsx      # Pantalla de batalla (/battle/:roomId)
    │   │   ├── results.tsx     # Resultados (/results/:roomId)
    │   │   ├── leaderboards.tsx # Ranking (/leaderboards)
    │   │   ├── history.tsx     # Historial de batallas (/history)
    │   │   ├── rules.tsx       # Reglas del juego (/rules)
    │   │   ├── pokedex.tsx     # Catálogo Pokémon (/pokedex)
    │   │   └── premium.tsx     # Página de pago Stripe (/premium)
    │   ├── lib/
    │   │   ├── sprites.ts      # getFrontSprite, getBackSprite, hpColor
    │   │   ├── poke-api.ts     # API client functions
    │   │   ├── musicProvider.tsx # Música por pantalla (bucle)
    │   │   └── useBattleSocket.ts  # WS hook con reconnect
    │   ├── stores/
    │   │   └── teamStore.ts    # Zustand: equipo en construcción
    │   └── types/
    │       └── index.ts        # WsMessage, BattleState, PokemonAPI, etc.
    └── package.json
```

---

## 📋 Scripts Disponibles

```bash
# Desarrollo (MongoDB + backend + frontend juntos)
npm run dev

# Solo backend (precisa MongoDB corriendo)
npm run dev:backend

# Solo frontend (Vite, puerto 3000)
npm run dev:frontend

# Solo MongoDB (via Docker)
npm run db:start    # docker compose up -d mongo
npm run db:stop     # docker compose stop mongo
npm run db:clean    # docker compose down -v

# Importar 300 Pokémon desde PokéAPI (~20 moves por Pokémon)
npm run import

# Generar movesets (12 attacks + 4 famous por Pokémon)
npm run generate-movesets

# Build producción backend
npm run build

# Linting + typecheck
npm run lint
npm run typecheck
```

---

## 🎮 Flujo de Pantallas

```
/ (Title) → /login (Clerk) → /home (Menú)
  → /play (Ranked o Casual)
    → /room/[roomId] (Lobby con chat + ready sync)
      → /teams/[roomId] (Team Builder — 6 Pokémon, 4 moves cada uno)
        → /battle/[roomId] (Combate por turnos)
          → /results/[roomId]
```

**Navegación standalone** (desde sidebar, sin contexto):
- `/leaderboards` — Ranking de jugadores
- `/history` — Historial de batallas propias
- `/rules` — Guía breve del juego
- `/pokedex` — Catálogo de los 300 Pokémon disponibles
- `/premium` — Página de pago ($14.99 one-time)

---

## ⚔️ Sistema de Combate

### Battle Engine (Gen 5 Style)

- **Nivel 50** para todos los Pokémon
- **HP:** `floor(((2*base+iv)*50)/100)+50+10` (IV random 0-31)
- **Stats:** `floor(((2*base+iv)*50)/100)+5`
- **Daño:** `floor((2*LEVEL/5+2)*power*atk/def/50)+2` × modifiers
- **Modifiers:** random(0.85-1.0) × STAB(1.5) × type_eff × critical(1.5) × burn(0.5)
- **Critical:** 1/24 chance
- **Status:** burn/poison = 6.25% HP/turn; paralysis = speed halved; duran 3 turnos
- **Orden:** move priority → effective speed → coin flip

### Roles de Pokémon

Cada Pokémon tiene un rol auto-detectado según sus moves:

| Rol | Descripción |
|-----|-------------|
| **Fisico** | 2+ physical moves con power > 70 |
| **Especial** | 2+ special moves con power > 70 |
| **Mixto** | 2+ setup moves (Swords Dance, Dragon Dance, etc.) |
| **Soporte** | Tiene move de curación (healing > 0 ó drain > 0) |
| **Asesino** | 2+ moves que aplican estado (burn, toxic, etc.) |
| **Tanque** | HP > 90 && Defense > 85 |

### 12 Ataques Seleccionables

Cada Pokémon tiene 12 ataques disponibles en MongoDB (modelo `Moveset`). El usuario elige **4 moves** para usar en batalla.

**Clasificación de moves:**
- **Field moves** — EXCLUÍDOS (Stealth Rock, Spikes, Reflect, etc.)
- **Healing** — prioridad máxima (2 slots)
- **Setup** — buffs de stats (2 slots)
- **Ailment** — aplica status (2 slots)
- **Debuff** — baja stats enemigos (2 slots)
- **Damaging** — daño directo (4 slots)

---

## 🌟 Sistema Premium

### Features Premium ($14.99 one-time)

1. **Sprites Shiny en Batalla**
   - Premium puede ACTIVAR shiny en sus Pokémon
   - Si un rival premium activa shiny → TODOS lo ven
   - No-premium solo puede VER shiny de premium, no puede activarlo

2. **Música Premium en Batalla**
   - 3 tracks extra random para batalla ranked
   - Verificado contra `isPremium` de ambos jugadores

### Stripe Integration

- Backend: `/api/payments/intent`, `/api/payments/confirm`, webhook `/api/stripe-webhook`
- Frontend: Página `/premium` con Stripe Elements
- DB: User con `isPremium`, `premiumPurchasedAt`, `stripeCustomerId`, `stripePaymentIntentId`

---

## 🎵 Sistema de Audio

### Música por Pantalla (bucle)

| Archivo | Pantalla |
|---------|----------|
| `Musica_Titulo.mp3` | `/title` |
| `Musica_Home.mp3` | `/home` |
| `Musica_Lobby.mp3` | `/room`, `/play`, `/teams` |
| `Musica_Pokedex.mp3` | `/pokedex` |
| `Batalla_Casual.mp3` | `/battle` (casual) |
| `Batalla_Ranked.mp3` | `/battle` (ranked) |
| `Victoria_Casual.mp3` | `/results` (victoria casual) |
| `Derrota_Casual.mp3` | `/results` (derrota casual) |
| `Victoria_Ranked.mp3` | `/results` (victoria ranked) |
| `Derrota_Ranked.mp3` | `/results` (derrota ranked) |

### Sonidos de Ataques

- `sonidos/Attack Moves/{moveName}.mp3` — 619 archivos
- Se reproducen al ejecutar un ataque en batalla

---

## 🔌 WebSocket Events

**Client → Server:** Actions van por REST `POST /api/battle/:roomCode/action`

**WS Server → Client (push only):**

```
PLAYER_CONNECTED, PLAYER_DISCONNECTED,
PLAYER_READY, LOBBY_READY,
BATTLE_STARTED (con selectedBattleMusic + premiumInfo),
TURN_RESOLVED (con BattleState completo),
BATTLE_ENDED (con winnerUserId)
```

---

## 🗄️ Modelos de Datos (MongoDB)

```typescript
// User — sync via Clerk webhook
{ odiserId, username, avatarUrl, elo: 1500, wins, losses, isPremium }

// Pokemon — cache PokéAPI
{ pokedexId, name, types, baseStats, spriteUrl, moveIds, isLegendary, isMythical, role }

// Moveset — 12 ataques por Pokémon
{ pokemonId, pokemonName, role, moves: [{ moveId, moveName, type, power, accuracy, damageClass, priority, category, soundPath, famous }] }

// Room — sala multiplayer
{ code, mode, status, players: [{ odiserId, name, side, ready }] }

// Battle — estado en MongoDB
{ roomCode, turn, status, players, battleLog, winnerUserId }

// Team — equipo guardado
{ odiserId, name, pokemons: [{ pokemonId, moves, shinyEnabled }] }
```

---

## ⚙️ Variables de Entorno

### Backend (`backend/.env`)

```env
MONGO_URI=mongodb://localhost:27017/pokebattle
PORT=3001
CLERK_SECRET_KEY=tu_clerk_secret_key
STRIPE_SECRET_KEY=tu_stripe_secret_key
```

### Frontend (`frontend/.env`)

```env
VITE_CLERK_PUBLISHABLE_KEY=tu_clerk_publishable_key
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=tu_stripe_publishable_key
```

---

## 📁 Recursos Externos

### Sprites

- **Primary:** Pokémon Showdown animated GIFs Gen 5
  - `https://play.pokemonshowdown.com/sprites/ani/{name}.gif`
  - `https://play.pokemonshowdown.com/sprites/ani-back/{name}.gif`
- **Fallback:** `spriteUrl` de MongoDB (PokéAPI static)
- **Shiny:** `https://play.pokemonshowdown.com/sprites/ani-shiny/{name}.gif`

### API

- **PokéAPI** — Importación de Pokémon, moves, tipos
- **Clerk** — Autenticación
- **Stripe** — Pagos

---

## 🎨 Design System

Ver `DESIGN.md` para tokens completos.

- **Colores:** Dark industrial palette con acentos verde/azul/rojo
- **Fonts:** Space Mono (headlines), JetBrains Mono (body/data)
- **Bordes:** 3px black en todos los containers
- **Chamfer cuts:** `clip-path: polygon(...)` en botones de alta prioridad
- **CRT overlay:** Scanlines fixed en `z-999`
- **HP bars:** Verde >50%, amarillo 25-50%, rojo <25%
- **Overflow:** `overflow-x: hidden` (permite scroll vertical)

---

## 🚧 Estado del Proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Scaffold + Docker + Backend + Frontend | ✅ |
| 1 | Title, Login, Home, Play, Room, Teams, Battle, Results, Leaderboards, History | ✅ |
| 2 | Import PokéAPI (300 Pokémon, moves, tipos) | ✅ |
| 3 | Sistema de roles + 12 ataques seleccionables | ✅ |
| 4 | Lobby con chat + sync READY + WS reconnect | ✅ |
| 5 | Música por pantalla + sonidos de ataques | ✅ |
| 6 | Battle Screen UI + animaciones | ✅ |
| 7 | Sistema Premium con Stripe ($14.99) | ✅ |
| 8 | Sistema Shiny en Batalla | ✅ |
| 9 | Música Premium en Batalla | ✅ |
| 10 | Draft Mode (Ranked: bans + picks) | 🔲 Pendiente |
| 11 | Post-Draft (elegir moves/ability) | 🔲 Pendiente |
| 12 | Results + Battle History real | 🔲 Pendiente |
| 13 | Ranked ELO + Leaderboards real | 🔲 Pendiente |

---

## 📜 Licencia

Privado — Proyecto de curso
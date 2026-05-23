---
name: pokemon-backend
description: >
  Build and extend the complete backend for the Pokémon Battle Rooms project:
  stack setup (Hono + Bun + MongoDB + Docker), PokéAPI import script, MongoDB
  schemas, REST API routes, and the full battle engine (turn resolution, damage
  formula, type effectiveness, status effects, stat stages, and victory
  detection). Use this skill whenever implementing or modifying any server-side
  feature: data import, room creation, turn processing, validation, or DB
  queries. Covers every section of the project rubric that lives on the server.
---

# Backend Skill — Pokémon Battle Rooms (Hono · Bun · MongoDB · Docker)

## 1 · Project structure

```
pokemon-battle-rooms/
├── docker-compose.yml
├── Dockerfile
├── .env
├── bun.lockb
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  ← Hono app entry + Bun server export
    ├── db.ts                     ← Mongoose connection
    ├── models/
    │   ├── Pokemon.ts
    │   ├── Move.ts
    │   ├── TypeRelation.ts
    │   ├── Room.ts
    │   └── Battle.ts
    ├── routes/
    │   ├── rooms.ts
    │   ├── battle.ts
    │   ├── pokemon.ts
    │   └── ws.ts                 ← see pokemon-websocket skill
    ├── services/
    │   ├── battleEngine.ts       ← damage, types, status, turn resolver
    │   └── roomService.ts
    ├── scripts/
    │   └── importFromPokeAPI.ts  ← run once to seed MongoDB
    └── types/
        ├── battle.ts
        └── wsMessages.ts
```

---

## 2 · Stack setup

### package.json

```json
{
  "name": "pokemon-battle-rooms",
  "scripts": {
    "dev":    "bun --watch src/index.ts",
    "start":  "bun src/index.ts",
    "import": "bun src/scripts/importFromPokeAPI.ts"
  },
  "dependencies": {
    "hono": "^4.4.0",
    "mongoose": "^8.4.0",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.0"
  }
}
```

### docker-compose.yml

```yaml
version: '3.9'
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]
    environment:
      MONGO_INITDB_DATABASE: pokebattle

  backend:
    build: .
    ports: ["3001:3001"]
    depends_on: [mongo]
    environment:
      MONGO_URI: mongodb://mongo:27017/pokebattle
      PORT: 3001
    volumes: [.:/app]
    command: bun --watch src/index.ts

volumes:
  mongo_data:
```

### Dockerfile

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
EXPOSE 3001
CMD ["bun", "src/index.ts"]
```

### src/db.ts

```ts
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/pokebattle';
  await mongoose.connect(uri);
  console.log('[DB] Connected to MongoDB');
}
```

### src/index.ts

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectDB } from './db';
import roomsRoute   from './routes/rooms';
import battleRoute  from './routes/battle';
import pokemonRoute from './routes/pokemon';
import wsRoute      from './routes/ws';

const app = new Hono();
app.use('/*', cors({ origin: '*' }));
app.use('/*', logger());

app.route('/api/rooms',   roomsRoute);
app.route('/api/battle',  battleRoute);
app.route('/api/pokemon', pokemonRoute);
app.route('/',            wsRoute);

await connectDB();

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
  websocket: { message() {}, open() {}, close() {} }, // Bun requirement
};
```

---

## 3 · MongoDB schemas

```ts
// src/models/Move.ts
import { Schema, model } from 'mongoose';

const MoveSchema = new Schema({
  pokeApiId:   { type: Number, unique: true },
  name:        String,
  type:        String,
  power:       Number,       // null for status moves
  accuracy:    Number,       // null = always hits
  priority:    { type: Number, default: 0 },
  damageClass: { type: String, enum: ['physical','special','status'] },
  effect:      String,       // short effect description from PokéAPI
});
export const MoveModel = model('Move', MoveSchema);

// src/models/Pokemon.ts
import { Schema, model } from 'mongoose';

const PokemonSchema = new Schema({
  pokedexId:  { type: Number, unique: true },
  name:       String,
  types:      [String],
  baseStats: {
    hp:             Number,
    attack:         Number,
    defense:        Number,
    specialAttack:  Number,
    specialDefense: Number,
    speed:          Number,
  },
  spriteUrl:  String,   // PokeAPI static sprite (fallback)
  moveIds:    [{ type: Schema.Types.ObjectId, ref: 'Move' }], // up to ~20 moves
});
export const PokemonModel = model('Pokemon', PokemonSchema);

// src/models/TypeRelation.ts
import { Schema, model } from 'mongoose';

const TypeRelationSchema = new Schema({
  attackingType: { type: String, unique: true },
  doubleDamageTo:   [String],
  halfDamageTo:     [String],
  noDamageTo:       [String],
});
export const TypeRelationModel = model('TypeRelation', TypeRelationSchema);

// src/models/Room.ts
import { Schema, model } from 'mongoose';

const RoomSchema = new Schema({
  code:      { type: String, unique: true },
  status:    { type: String, enum: ['waiting','selecting','battle','finished'], default: 'waiting' },
  players:   [{ playerId: String, name: String, ready: Boolean }],
  createdAt: { type: Date, default: Date.now },
});
export const RoomModel = model('Room', RoomSchema);

// src/models/Battle.ts
import { Schema, model } from 'mongoose';

const BattlePokemonSchema = new Schema({
  pokemonId:      Schema.Types.ObjectId,
  name:           String,
  types:          [String],
  spriteUrl:      String,
  currentHp:      Number,
  maxHp:          Number,
  battleStats: {
    attack: Number, defense: Number,
    specialAttack: Number, specialDefense: Number, speed: Number,
  },
  ivs: { hp: Number, attack: Number, defense: Number,
         specialAttack: Number, specialDefense: Number, speed: Number },
  moves:   [{ moveId: Schema.Types.ObjectId, name: String, type: String,
              power: Number, accuracy: Number, priority: Number, damageClass: String }],
  status:  { type: String, default: null }, // 'burn','poison','paralyze', etc.
  statusTurns: { type: Number, default: 0 },
  statStages: {
    attack: { type: Number, default: 0 }, defense: { type: Number, default: 0 },
    specialAttack: { type: Number, default: 0 }, specialDefense: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
  },
}, { _id: false });

const PlayerStateSchema = new Schema({
  playerId:        String,
  name:            String,
  team:            [BattlePokemonSchema],
  activePokemonIdx: { type: Number, default: 0 },
  selectedAction:  Schema.Types.Mixed,  // null until submitted this turn
}, { _id: false });

const BattleSchema = new Schema({
  roomCode:      String,
  turn:          { type: Number, default: 1 },
  status:        { type: String, enum: ['waiting','active','finished'], default: 'waiting' },
  players:       [PlayerStateSchema],
  battleLog:     [String],
  winnerPlayerId:{ type: String, default: null },
  updatedAt:     { type: Date, default: Date.now },
});
export const BattleModel = model('Battle', BattleSchema);
```

---

## 4 · PokéAPI import script

Run **once** before starting the app: `bun src/scripts/importFromPokeAPI.ts`

```ts
// src/scripts/importFromPokeAPI.ts
import { connectDB } from '../db';
import { PokemonModel } from '../models/Pokemon';
import { MoveModel }    from '../models/Move';
import { TypeRelationModel } from '../models/TypeRelation';

const POKEMON_LIMIT = 300;
const MOVE_CACHE = new Map<string, string>(); // name → mongo _id

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

async function importMove(url: string): Promise<string | null> {
  if (MOVE_CACHE.has(url)) return MOVE_CACHE.get(url)!;

  try {
    const data = await fetchJSON(url);
    // Skip moves with no power and no useful effect (e.g. purely cosmetic)
    const existing = await MoveModel.findOne({ pokeApiId: data.id });
    if (existing) { MOVE_CACHE.set(url, String(existing._id)); return String(existing._id); }

    const move = await MoveModel.create({
      pokeApiId:   data.id,
      name:        data.name,
      type:        data.type.name,
      power:       data.power ?? null,
      accuracy:    data.accuracy ?? null,
      priority:    data.priority ?? 0,
      damageClass: data.damage_class.name,
      effect:      data.effect_entries.find((e: any) => e.language.name === 'en')?.short_effect ?? '',
    });
    MOVE_CACHE.set(url, String(move._id));
    return String(move._id);
  } catch {
    return null;
  }
}

async function importTypes() {
  const typeList = await fetchJSON('https://pokeapi.co/api/v2/type?limit=20');
  for (const t of typeList.results) {
    const data = await fetchJSON(t.url);
    const rel = data.damage_relations;
    await TypeRelationModel.findOneAndUpdate(
      { attackingType: data.name },
      {
        attackingType:  data.name,
        doubleDamageTo: rel.double_damage_to.map((x: any) => x.name),
        halfDamageTo:   rel.half_damage_to.map((x: any) => x.name),
        noDamageTo:     rel.no_damage_to.map((x: any) => x.name),
      },
      { upsert: true },
    );
    console.log(`[types] imported ${data.name}`);
  }
}

async function main() {
  await connectDB();
  await importTypes();

  const list = await fetchJSON(
    `https://pokeapi.co/api/v2/pokemon?limit=${POKEMON_LIMIT}&offset=0`,
  );

  for (const entry of list.results) {
    try {
      const data = await fetchJSON(entry.url);

      // Collect move URLs, fetch each, keep ones with power or status effect
      const moveUrls: string[] = data.moves
        .map((m: any) => m.move.url)
        .slice(0, 40); // cap fetches per pokémon

      const moveIds: string[] = [];
      for (const url of moveUrls) {
        if (moveIds.length >= 20) break; // store at most 20 per pokémon
        const id = await importMove(url);
        if (id) moveIds.push(id);
      }

      // Need at least 4 valid moves
      if (moveIds.length < 4) {
        console.warn(`[skip] ${data.name} — only ${moveIds.length} moves`);
        continue;
      }

      const statsMap: Record<string, number> = {};
      for (const s of data.stats) {
        statsMap[s.stat.name] = s.base_stat;
      }

      await PokemonModel.findOneAndUpdate(
        { pokedexId: data.id },
        {
          pokedexId: data.id,
          name:      data.name,
          types:     data.types.map((t: any) => t.type.name),
          baseStats: {
            hp:             statsMap['hp'],
            attack:         statsMap['attack'],
            defense:        statsMap['defense'],
            specialAttack:  statsMap['special-attack'],
            specialDefense: statsMap['special-defense'],
            speed:          statsMap['speed'],
          },
          spriteUrl:  data.sprites.front_default,
          moveIds,
        },
        { upsert: true },
      );
      console.log(`[import] ${data.name} (${moveIds.length} moves)`);
    } catch (err) {
      console.error(`[error] ${entry.name}`, err);
    }
  }

  console.log('[done] Import complete');
  process.exit(0);
}

main();
```

---

## 5 · Battle engine (`src/services/battleEngine.ts`)

### 5.1 IV generation & stat calculation

```ts
const LEVEL = 50;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateIVs() {
  return {
    hp: randomInt(0, 31), attack: randomInt(0, 31),
    defense: randomInt(0, 31), specialAttack: randomInt(0, 31),
    specialDefense: randomInt(0, 31), speed: randomInt(0, 31),
  };
}

function calcHp(base: number, iv: number) {
  return Math.floor(((2 * base + iv) * LEVEL) / 100) + LEVEL + 10;
}

function calcStat(base: number, iv: number) {
  return Math.floor(((2 * base + iv) * LEVEL) / 100) + 5;
}
```

### 5.2 Stat stage modifier

```ts
function stageMultiplier(stage: number) {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

function effectiveStat(base: number, stage: number) {
  return Math.floor(base * stageMultiplier(stage));
}
```

### 5.3 Type effectiveness (from MongoDB)

```ts
import { TypeRelationModel } from '../models/TypeRelation';

// Cache all type relations at startup
let typeCache: Map<string, { doubleTo: Set<string>; halfTo: Set<string>; noTo: Set<string> }>;

export async function loadTypeCache() {
  const all = await TypeRelationModel.find();
  typeCache = new Map();
  for (const t of all) {
    typeCache.set(t.attackingType, {
      doubleTo: new Set(t.doubleDamageTo),
      halfTo:   new Set(t.halfDamageTo),
      noTo:     new Set(t.noDamageTo),
    });
  }
}

function getMultiplier(attackType: string, defenderType: string): number {
  const rel = typeCache.get(attackType);
  if (!rel) return 1;
  if (rel.noTo.has(defenderType))     return 0;
  if (rel.doubleTo.has(defenderType)) return 2;
  if (rel.halfTo.has(defenderType))   return 0.5;
  return 1;
}

export function typeEffectiveness(attackType: string, defenderTypes: string[]): number {
  return defenderTypes.reduce((acc, dt) => acc * getMultiplier(attackType, dt), 1);
}
```

### 5.4 Damage formula

```ts
export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: BattleMove,
): { damage: number; effectiveness: number; isCritical: boolean; missed: boolean } {
  // Miss check
  const accuracy = move.accuracy ?? 100;
  if (randomInt(1, 100) > accuracy) {
    return { damage: 0, effectiveness: 1, isCritical: false, missed: true };
  }

  // Status move → no damage
  if (move.damageClass === 'status' || !move.power) {
    return { damage: 0, effectiveness: 1, isCritical: false, missed: false };
  }

  // Choose attack/defense stats
  const isPhysical = move.damageClass === 'physical';
  const atkStage = isPhysical ? attacker.statStages.attack : attacker.statStages.specialAttack;
  const defStage = isPhysical ? defender.statStages.defense : defender.statStages.specialDefense;

  const atkBase = isPhysical ? attacker.battleStats.attack : attacker.battleStats.specialAttack;
  const defBase = isPhysical ? defender.battleStats.defense : defender.battleStats.specialDefense;

  const atk = effectiveStat(atkBase, atkStage);
  const def = effectiveStat(defBase, defStage);

  // Base damage
  const base = Math.floor(
    Math.floor(
      (Math.floor((2 * LEVEL) / 5 + 2) * move.power * atk) / def,
    ) / 50,
  ) + 2;

  // Modifiers
  const randomFactor = randomInt(85, 100) / 100;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, defender.types);
  const isCritical = Math.random() < 1 / 24;
  const critical = isCritical ? 1.5 : 1;
  const burnModifier = (attacker.status === 'burn' && isPhysical) ? 0.5 : 1;

  if (effectiveness === 0) return { damage: 0, effectiveness: 0, isCritical: false, missed: false };

  const modifier = randomFactor * stab * effectiveness * critical * burnModifier;
  const damage = Math.max(1, Math.floor(base * modifier));

  return { damage, effectiveness, isCritical, missed: false };
}
```

### 5.5 Status effects

```ts
const STATUS_EFFECTS: Record<string, string[]> = {
  burn:     ['Burned! Loses HP each turn. Physical moves weakened.'],
  poison:   ['Poisoned! Loses HP each turn.'],
  paralyze: ['Paralyzed! Speed halved.'],
  sleep:    ['Fell asleep!'],
  freeze:   ['Frozen solid!'],
};

function applyPassiveStatus(pokemon: BattlePokemon, log: string[]) {
  if (!pokemon.status || pokemon.statusTurns <= 0) return;

  if (pokemon.status === 'burn' || pokemon.status === 'poison') {
    const dmg = Math.floor(pokemon.maxHp * 0.0625);
    pokemon.currentHp = Math.max(0, pokemon.currentHp - dmg);
    log.push(`${pokemon.name} is hurt by ${pokemon.status}! (-${dmg} HP)`);
  }

  pokemon.statusTurns -= 1;
  if (pokemon.statusTurns <= 0) {
    log.push(`${pokemon.name}'s ${pokemon.status} wore off.`);
    pokemon.status = null;
    pokemon.statusTurns = 0;
  }
}

function applyMoveStatus(move: BattleMove, target: BattlePokemon, log: string[]) {
  // Only apply if move has a status effect keyword and target has no existing status
  if (target.status) return;
  const effect = move.effect?.toLowerCase() ?? '';

  let newStatus: string | null = null;
  if (effect.includes('burn'))     newStatus = 'burn';
  else if (effect.includes('poison'))   newStatus = 'poison';
  else if (effect.includes('paralyz'))  newStatus = 'paralyze';
  else if (effect.includes('sleep'))    newStatus = 'sleep';
  else if (effect.includes('freeze'))   newStatus = 'freeze';

  if (newStatus && Math.random() < 0.3) { // 30% chance for secondary effects
    target.status = newStatus;
    target.statusTurns = 3;
    log.push(`${target.name} is now ${newStatus}!`);
  }
}

function clearStatus(pokemon: BattlePokemon) {
  pokemon.status = null;
  pokemon.statusTurns = 0;
  pokemon.statStages = { attack:0, defense:0, specialAttack:0, specialDefense:0, speed:0 };
}
```

### 5.6 Turn resolver

```ts
import { BattleModel } from '../models/Battle';
import { broadcastToRoom } from '../ws/roomRegistry';

export async function resolveTurn(roomCode: string) {
  const battle = await BattleModel.findOne({ roomCode });
  if (!battle || battle.status !== 'active') return;

  const [p1, p2] = battle.players;

  // Both must have submitted an action
  if (!p1.selectedAction || !p2.selectedAction) return;

  const log: string[] = [];

  // --- Order of actions ---
  function actionPriority(player: typeof p1) {
    const action = player.selectedAction;
    if (action.type === 'switch') return 6;
    return action.move?.priority ?? 0;
  }

  function effectiveSpeed(player: typeof p1) {
    const active = player.team[player.activePokemonIdx];
    let spd = effectiveStat(active.battleStats.speed, active.statStages.speed);
    if (active.status === 'paralyze') spd = Math.floor(spd / 2);
    return spd;
  }

  let order: [typeof p1, typeof p2] | [typeof p2, typeof p1];
  const p1Pri = actionPriority(p1);
  const p2Pri = actionPriority(p2);

  if (p1Pri !== p2Pri) {
    order = p1Pri > p2Pri ? [p1, p2] : [p2, p1];
  } else {
    const p1Spd = effectiveSpeed(p1);
    const p2Spd = effectiveSpeed(p2);
    if (p1Spd !== p2Spd) {
      order = p1Spd > p2Spd ? [p1, p2] : [p2, p1];
    } else {
      order = Math.random() < 0.5 ? [p1, p2] : [p2, p1];
    }
  }

  // --- Execute each action ---
  for (const actor of order) {
    const other = actor === p1 ? p2 : p1;
    const action = actor.selectedAction;
    const active = actor.team[actor.activePokemonIdx];
    const target = other.team[other.activePokemonIdx];

    // Check actor's active pokemon is still alive
    if (active.currentHp <= 0) continue;

    if (action.type === 'switch') {
      const newIdx = actor.team.findIndex(
        (p, i) => i !== actor.activePokemonIdx && p.currentHp > 0 && String(p.pokemonId) === action.pokemonId,
      );
      if (newIdx !== -1) {
        clearStatus(active);
        actor.activePokemonIdx = newIdx;
        log.push(`${actor.name} switched to ${actor.team[newIdx].name}!`);
      }
    } else if (action.type === 'move') {
      const move = active.moves.find(m => String(m.moveId) === action.moveId);
      if (!move) continue;

      log.push(`${active.name} used ${move.name}!`);

      const { damage, effectiveness, isCritical, missed } = calculateDamage(active, target, move);

      if (missed) {
        log.push(`${active.name}'s attack missed!`);
      } else if (effectiveness === 0) {
        log.push(`It had no effect on ${target.name}…`);
      } else {
        if (isCritical) log.push('A critical hit!');
        if (effectiveness > 1) log.push("It's super effective!");
        if (effectiveness < 1) log.push("It's not very effective…");

        target.currentHp = Math.max(0, target.currentHp - damage);
        log.push(`${target.name} took ${damage} damage. (${target.currentHp}/${target.maxHp} HP)`);

        // Apply status from move
        applyMoveStatus(move, target, log);

        if (target.currentHp === 0) {
          log.push(`${target.name} fainted!`);
          // Force switch if alive pokemon remain
          const nextAlive = other.team.findIndex((p, i) => i !== other.activePokemonIdx && p.currentHp > 0);
          if (nextAlive !== -1) other.activePokemonIdx = nextAlive;
        }
      }
    }
  }

  // --- Passive status damage (end of turn) ---
  for (const player of [p1, p2]) {
    const active = player.team[player.activePokemonIdx];
    if (active.currentHp > 0) applyPassiveStatus(active, log);
  }

  // --- Victory check ---
  function allFainted(player: typeof p1) {
    return player.team.every(p => p.currentHp <= 0);
  }

  let winner: string | null = null;
  if (allFainted(p1)) { winner = p2.playerId; log.push(`${p2.name} wins! 🎉`); }
  if (allFainted(p2)) { winner = p1.playerId; log.push(`${p1.name} wins! 🎉`); }

  // --- Clear actions, increment turn ---
  p1.selectedAction = null;
  p2.selectedAction = null;
  battle.turn += 1;
  battle.battleLog.push(...log);
  if (winner) { battle.status = 'finished'; battle.winnerPlayerId = winner; }
  battle.updatedAt = new Date();

  await battle.save();

  broadcastToRoom(roomCode, { type: 'TURN_RESOLVED', battle: battle.toObject() });
  if (winner) broadcastToRoom(roomCode, { type: 'BATTLE_ENDED', winnerPlayerId: winner });
}
```

---

## 6 · REST routes

### rooms.ts

```ts
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { RoomModel }  from '../models/Room';
import { BattleModel } from '../models/Battle';
import { PokemonModel } from '../models/Pokemon';
import { resolveTurn } from '../services/battleEngine';

const rooms = new Hono();

// POST /api/rooms — create room
rooms.post('/', async c => {
  const { name } = await c.req.json<{ name: string }>();
  const code = nanoid(6).toUpperCase();
  const playerId = nanoid(12);
  const room = await RoomModel.create({
    code,
    players: [{ playerId, name, ready: false }],
  });
  return c.json({ code, playerId });
});

// POST /api/rooms/:code/join — join room
rooms.post('/:code/join', async c => {
  const { name } = await c.req.json<{ name: string }>();
  const room = await RoomModel.findOne({ code: c.req.param('code') });
  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.players.length >= 2) return c.json({ error: 'Room full' }, 400);

  const playerId = nanoid(12);
  room.players.push({ playerId, name, ready: false });
  await room.save();
  return c.json({ code: room.code, playerId });
});

// POST /api/rooms/:code/team — submit team selection
rooms.post('/:code/team', async c => {
  const { playerId, pokemonIds } = await c.req.json<{ playerId: string; pokemonIds: string[] }>();
  if (pokemonIds.length < 1 || pokemonIds.length > 6)
    return c.json({ error: 'Team must be 1–6 Pokémon' }, 400);

  // Build BattlePokemon objects with IVs and stats
  const pokemons = await PokemonModel.find({ _id: { $in: pokemonIds } }).populate('moveIds');

  const team = pokemons.map(pk => {
    const ivs = { hp: ri(31), attack: ri(31), defense: ri(31),
                  specialAttack: ri(31), specialDefense: ri(31), speed: ri(31) };
    const maxHp = calcHp(pk.baseStats.hp, ivs.hp);
    // Pick exactly 4 moves — prefer moves with power, pad with status moves
    const withPower = (pk.moveIds as any[]).filter(m => m.power);
    const status    = (pk.moveIds as any[]).filter(m => !m.power);
    const movePool  = [...withPower, ...status].slice(0, 4);
    if (movePool.length < 4) throw new Error(`${pk.name} has fewer than 4 moves`);

    return {
      pokemonId: pk._id, name: pk.name, types: pk.types, spriteUrl: pk.spriteUrl,
      currentHp: maxHp, maxHp,
      battleStats: {
        attack:         cs(pk.baseStats.attack,         ivs.attack),
        defense:        cs(pk.baseStats.defense,        ivs.defense),
        specialAttack:  cs(pk.baseStats.specialAttack,  ivs.specialAttack),
        specialDefense: cs(pk.baseStats.specialDefense, ivs.specialDefense),
        speed:          cs(pk.baseStats.speed,          ivs.speed),
      },
      ivs,
      moves: movePool.map(m => ({
        moveId: m._id, name: m.name, type: m.type, power: m.power,
        accuracy: m.accuracy, priority: m.priority, damageClass: m.damageClass,
        effect: m.effect,
      })),
      status: null, statusTurns: 0,
      statStages: { attack:0, defense:0, specialAttack:0, specialDefense:0, speed:0 },
    };
  });

  // Upsert player state into Battle document
  let battle = await BattleModel.findOne({ roomCode: c.req.param('code') });
  if (!battle) battle = new BattleModel({ roomCode: c.req.param('code'), players: [] });

  const existing = battle.players.find(p => p.playerId === playerId);
  const playerState = { playerId, name: '', team, activePokemonIdx: 0, selectedAction: null };
  if (existing) Object.assign(existing, playerState);
  else battle.players.push(playerState);

  if (battle.players.length === 2) {
    battle.status = 'active';
    // broadcast BATTLE_STARTED via broadcastToRoom (see websocket skill)
  }
  await battle.save();
  return c.json({ ok: true });
});

function ri(max: number) { return Math.floor(Math.random() * (max + 1)); }
function calcHp(b: number, iv: number) { return Math.floor(((2*b+iv)*50)/100)+50+10; }
function cs(b: number, iv: number)    { return Math.floor(((2*b+iv)*50)/100)+5; }

export default rooms;
```

### battle.ts

```ts
import { Hono } from 'hono';
import { BattleModel } from '../models/Battle';
import { resolveTurn } from '../services/battleEngine';

const battle = new Hono();

// POST /api/battle/:roomCode/action
battle.post('/:roomCode/action', async c => {
  const { playerId, type, moveId, pokemonId } = await c.req.json();
  const b = await BattleModel.findOne({ roomCode: c.req.param('roomCode') });
  if (!b || b.status !== 'active') return c.json({ error: 'No active battle' }, 400);

  const player = b.players.find(p => p.playerId === playerId);
  if (!player) return c.json({ error: 'Player not in this battle' }, 403);
  if (player.selectedAction) return c.json({ error: 'Already submitted this turn' }, 400);

  const active = player.team[player.activePokemonIdx];
  if (active.currentHp <= 0) return c.json({ error: 'Active Pokémon is fainted' }, 400);

  if (type === 'move') {
    const valid = active.moves.find(m => String(m.moveId) === moveId);
    if (!valid) return c.json({ error: 'Invalid move' }, 400);
    player.selectedAction = { type: 'move', moveId };
  } else if (type === 'switch') {
    const target = player.team.find(
      (p, i) => i !== player.activePokemonIdx && p.currentHp > 0 && String(p.pokemonId) === pokemonId,
    );
    if (!target) return c.json({ error: 'Invalid switch target' }, 400);
    player.selectedAction = { type: 'switch', pokemonId };
  } else {
    return c.json({ error: 'Unknown action type' }, 400);
  }

  await b.save();

  // Resolve if both players submitted
  const bothReady = b.players.every(p => p.selectedAction !== null);
  if (bothReady) await resolveTurn(c.req.param('roomCode'));

  return c.json({ ok: true });
});

// GET /api/battle/:roomCode — fetch current state (fallback for reconnection)
battle.get('/:roomCode', async c => {
  const b = await BattleModel.findOne({ roomCode: c.req.param('roomCode') }).lean();
  if (!b) return c.json({ error: 'Not found' }, 404);
  return c.json(b);
});

export default battle;
```

### pokemon.ts

```ts
import { Hono } from 'hono';
import { PokemonModel } from '../models/Pokemon';

const pokemon = new Hono();

pokemon.get('/', async c => {
  const { q, type, page = '1', limit = '30' } = c.req.query();
  const filter: Record<string, unknown> = {};
  if (q)    filter.name = { $regex: q, $options: 'i' };
  if (type) filter.types = type;
  const skip = (Number(page) - 1) * Number(limit);
  const data = await PokemonModel.find(filter).skip(skip).limit(Number(limit)).lean();
  return c.json(data);
});

pokemon.get('/:id', async c => {
  const data = await PokemonModel.findById(c.req.param('id')).populate('moveIds').lean();
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

export default pokemon;
```

---

## 7 · README template

````md
# Pokémon Battle Rooms

## Stack
- Runtime: Bun
- Framework: Hono
- Database: MongoDB (Mongoose)
- Frontend: TanStack Start + React
- Realtime: WebSockets (Bun native)
- Container: Docker + Docker Compose

## Running locally

```bash
docker compose up -d mongo
bun install
bun run import        # seeds 300+ Pokémon from PokéAPI (run once)
bun run dev           # starts backend on :3001
```

## Data import process
1. Fetches paginated list of 300 Pokémon from `https://pokeapi.co/api/v2/pokemon?limit=300`.
2. For each Pokémon, fetches detail endpoint to get stats, types, sprite, and move URLs.
3. For each move URL, fetches move detail and stores power, accuracy, priority, damageClass, effect.
4. Fetches all 18 type endpoints and stores damage relations.
5. All data is upserted into MongoDB so re-running is idempotent.

## Battle rules implemented
- Level 50 fixed, IVs randomised per battle.
- Damage formula: Gen 5 style (power × Atk/Def × level factor / 50 + 2).
- STAB ×1.5, type effectiveness ×2/×0.5/×0 from PokéAPI data.
- Critical hits: 1/24 chance ×1.5.
- Random factor: 85–100 %.
- Burn: ×0.5 on physical moves, 6.25 % HP loss per turn.
- Poison: 6.25 % HP loss per turn.
- Paralysis: speed halved.
- All statuses last 3 turns; cleared on switch.
- Turn order: switch > move priority > effective speed > coin flip.

## Known limitations
- No items.
- No weather/field.
- Paralysis chance-to-skip turn not implemented (optional).
````

---

## 8 · Validation checklist (maps to rubric)

| Rubric criterion | Where implemented |
|---|---|
| PokéAPI import + MongoDB persistence | `scripts/importFromPokeAPI.ts` |
| ≥300 Pokémon, sprites, types, stats, 4 moves | Import script + `PokemonModel` |
| Room system 1v1 with code | `routes/rooms.ts` POST / join |
| Battle engine: turns, damage, status, switch, victory | `services/battleEngine.ts` |
| Type vulnerabilities from PokéAPI | `TypeRelationModel` + `typeEffectiveness()` |
| Backend validates actions, resolves turns | `routes/battle.ts` POST action |
| Docker + README | `docker-compose.yml` + README template above |

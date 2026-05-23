import { Schema, model } from 'mongoose';
import { MovesetModel } from './Moveset';

const MoveSchema = new Schema({
  pokeApiId: { type: Number, unique: true },
  name: String,
  type: String,
  power: Number, // null for status moves
  accuracy: Number, // null = always hits
  priority: { type: Number, default: 0 },
  damageClass: { type: String, enum: ['physical', 'special', 'status'] },
  effect: String,
  meta: {
    category: String, // 'damage' | 'damage-ailment' | 'net-good-stats' | 'net-poor-stats' | 'heal' | 'field-effect' | ...
    healing: { type: Number, default: 0 },
    drain: { type: Number, default: 0 },
    ailment: { type: String, default: 'none' }, // 'burn', 'paralysis', 'toxic', etc.
    statChanges: [{ stat: String, change: Number }],
    target: { name: String }, // 'selected-pokemon', 'opponents-field', etc.
  },
});
export const MoveModel = model('Move', MoveSchema);

const PokemonSchema = new Schema({
  pokedexId: { type: Number, unique: true },
  name: String,
  types: [String],
  baseStats: {
    hp: Number,
    attack: Number,
    defense: Number,
    specialAttack: Number,
    specialDefense: Number,
    speed: Number,
  },
  spriteUrl: String,
  moveIds: [{ type: Schema.Types.ObjectId, ref: 'Move' }],
  isLegendary: { type: Boolean, default: false },
  isMythical: { type: Boolean, default: false },
  generation: { type: Number, default: 1 },
  role: { type: String, enum: ['Fisico', 'Especial', 'Tanque', 'Asesino', 'Soporte', 'Mixto'] },
});
export const PokemonModel = model('Pokemon', PokemonSchema);

const TypeRelationSchema = new Schema({
  attackingType: { type: String, unique: true },
  doubleDamageTo: [String],
  halfDamageTo: [String],
  noDamageTo: [String],
});
export const TypeRelationModel = model('TypeRelation', TypeRelationSchema);

const UserSchema = new Schema({
  odiserId: { type: String, unique: true }, // Clerk user ID
  username: String,
  avatarUrl: String,
  elo: { type: Number, default: 1500 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false },
  premiumPurchasedAt: { type: Date, default: null },
  stripeCustomerId: { type: String, default: null },
  stripePaymentIntentId: { type: String, default: null },
}, { timestamps: true });
export const UserModel = model('User', UserSchema);

const RoomSchema = new Schema({
  code: { type: String, unique: true },
  mode: { type: String, enum: ['casual', 'ranked'] },
  status: {
    type: String,
    enum: ['waiting', 'drafting', 'post-draft', 'battling', 'finished', 'teams'],
    default: 'waiting',
  },
  players: [{
    odiserId: String,
    name: String,
    side: { type: String, enum: ['blue', 'red'] },
    ready: { type: Boolean, default: false },
    teamReady: { type: Boolean, default: false },
  }],
  bans: { blue: [Number], red: [Number], default: { blue: [], red: [] } },
  picks: { blue: [Number], red: [Number], default: { blue: [], red: [] } },
  rematchRequested: { type: Map, of: Boolean, default: {} }, // Map<odiserId, true/false>
}, { timestamps: true });
export const RoomModel = model('Room', RoomSchema);

const BattlePokemonSchema = new Schema({
  pokemonId: Number,  // Es el pokedexId (ej: 248 para Tyranitar)
  name: String,
  types: [String],
  spriteUrl: String,
  currentHp: Number,
  maxHp: Number,
  battleStats: {
    attack: Number, defense: Number,
    specialAttack: Number, specialDefense: Number, speed: Number,
  },
  ivs: {
    hp: Number, attack: Number, defense: Number,
    specialAttack: Number, specialDefense: Number, speed: Number,
  },
  moves: Schema.Types.Mixed, // Array de 4 moves famous (sin schema validation)
  status: { type: String, default: null },
  statusTurns: { type: Number, default: 0 },
  statStages: {
    attack: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    specialAttack: { type: Number, default: 0 },
    specialDefense: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
  },
}, { _id: false });

const PlayerStateSchema = new Schema({
  odiserId: String,
  name: String,
  side: { type: String, enum: ['blue', 'red'] },
  team: [BattlePokemonSchema],
  activePokemonIdx: { type: Number, default: 0 },
  selectedAction: Schema.Types.Mixed,
  shinyEnabled: [{ type: Boolean, default: false }], // Array de bool por posicion en el equipo
}, { _id: false });

const BattleSchema = new Schema({
  roomCode: String,
  turn: { type: Number, default: 1 },
  status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
  players: [PlayerStateSchema],
  battleLog: [String],
  winnerUserId: { type: String, default: null },
}, { timestamps: true });
export const BattleModel = model('Battle', BattleSchema);

const TeamSchema = new Schema({
  odiserId: String,
  name: String,
  pokemons: [{
    pokemonId: Number,
    shiny: { type: Boolean, default: false },
    shinyEnabled: { type: Boolean, default: false },
  }],
}, { timestamps: true });
export const TeamModel = model('Team', TeamSchema);

const BattleHistorySchema = new Schema({
  roomCode: String,
  players: [{
    odiserId: String,
    name: String,
    team: [{
      pokemonId: Number,
      name: String,
      pokemonRemaining: Number,
    }],
    totalDamageDealt: Number,
  }],
  winnerUserId: String,
  turnCount: Number,
  mode: { type: String, enum: ['casual', 'ranked'] },
}, { timestamps: true });
export const BattleHistoryModel = model('BattleHistory', BattleHistorySchema);

const ChatMessageSchema = new Schema({
  roomCode: String,
  playerId: String,
  name: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});
export const ChatMessageModel = model('ChatMessage', ChatMessageSchema);

export { MovesetModel } from './Moveset';
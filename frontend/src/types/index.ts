export type WsMessage =
  | { type: 'PLAYER_CONNECTED'; playerId: string; roomCode: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; roomCode: string }
  | { type: 'LOBBY_READY'; players: { playerId: string; name: string }[] }
  | { type: 'TEAM_READY'; odiserId: string; roomCode: string }
  | { type: 'BOTH_TEAMS_READY'; roomCode: string }
  | { type: 'TEAM_CANCELLED'; odiserId: string; roomCode: string }
  | {
      type: 'BATTLE_STARTED';
      battle: BattleState;
      premiumInfo?: {
        player1HasPremium: boolean;
        player2HasPremium: boolean;
      };
      selectedBattleMusic?: string;
    }
  | { type: 'TURN_RESOLVED'; battle: BattleState }
  | { type: 'BATTLE_ENDED'; winnerUserId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'PING' }
  | { type: 'PONG' };

export interface BattleState {
  roomCode: string;
  turn: number;
  status: 'waiting' | 'active' | 'finished';
  players: PlayerState[];
  battleLog: string[];
  winnerUserId: string | null;
}

export interface PlayerState {
  odiserId: string;
  name: string;
  side: 'blue' | 'red';
  team: BattlePokemon[];
  activePokemonIdx: number;
  selectedAction: null | { type: 'move' | 'switch'; moveId?: string; pokemonId?: string };
}

export interface BattlePokemon {
  pokemonId: string;
  name: string;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
  battleStats: {
    attack: number; defense: number;
    specialAttack: number; specialDefense: number; speed: number;
  };
  ivs: {
    hp: number; attack: number; defense: number;
    specialAttack: number; specialDefense: number; speed: number;
  };
  moves: BattleMove[];
  status: string | null;
  statusTurns: number;
  statStages: {
    attack: number; defense: number;
    specialAttack: number; specialDefense: number; speed: number;
  };
}

export interface BattleMove {
  moveId: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: string;
}

export interface PokemonAPI {
  _id: string;
  pokedexId: number;
  name: string;
  types: string[];
  baseStats: {
    hp: number; attack: number; defense: number;
    specialAttack: number; specialDefense: number; speed: number;
  };
  spriteUrl: string;
  moveIds: MoveAPI[];
  isLegendary: boolean;
  isMythical: boolean;
  generation: number;
  role?: string;
}

export interface MoveAPI {
  _id: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: 'physical' | 'special' | 'status';
  effect?: string;
}

export interface MovesetEntry {
  moveId: number;
  moveName: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  damageClass: 'physical' | 'special' | 'status';
  priority: number;
  category: 'damage' | 'healing' | 'setup' | 'ailment' | 'debuff';
  soundPath: string | null;
  famous: boolean;
}

export interface Moveset {
  pokemonId: number;
  pokemonName: string;
  role: 'Fisico' | 'Especial' | 'Tanque' | 'Asesino' | 'Soporte' | 'Mixto';
  moves: MovesetEntry[];
}
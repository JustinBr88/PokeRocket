import { Types } from 'mongoose';

// Types
export type Role = 'sweeper' | 'buffer' | 'support' | 'status_applier' | 'tank' | 'debuffer';

export interface MoveMeta {
  category: string;
  healing: number;
  drain: number;
  ailment: string;
  statChanges: Array<{ stat: string; change: number }>;
}

export interface MoveDocument {
  _id: Types.ObjectId;
  pokeApiId: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: string;
  effect: string;
  meta: MoveMeta;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

// Role detection algorithm
// Priority: support > buffer > status_applier > debuffer > tank > sweeper
export function detectRole(
  moves: MoveDocument[],
  baseStats: BaseStats
): Role {
  if (moves.length === 0) {
    return 'sweeper';
  }

  // 1. Support — healing or drain moves
  const hasHealing = moves.some(
    (m) => (m.meta?.healing ?? 0) > 0 || (m.meta?.drain ?? 0) > 0
  );
  if (hasHealing) {
    return 'support';
  }

  // 2. Buffer — 2+ setup moves (stat increases)
  const setupMoves = moves.filter((m) =>
    m.meta?.statChanges?.some((s) => s.change > 0)
  );
  if (setupMoves.length >= 2) {
    return 'buffer';
  }

  // 3. Status Applier — 2+ moves that apply status conditions
  const ailmentMoves = moves.filter((m) => m.meta?.ailment && m.meta.ailment !== 'none');
  if (ailmentMoves.length >= 2) {
    return 'status_applier';
  }

  // 4. Debuffer — 2+ moves that lower enemy stats
  const debuffMoves = moves.filter((m) =>
    m.meta?.statChanges?.some((s) => s.change < 0)
  );
  if (debuffMoves.length >= 2) {
    return 'debuffer';
  }

  // 5. Tank — high HP and defense
  if (baseStats.hp > 90 && baseStats.defense > 85) {
    return 'tank';
  }

  // 6. Sweeper — 2+ strong moves (power > 70)
  const strongMoves = moves.filter((m) => (m.power ?? 0) > 70);
  if (strongMoves.length >= 2) {
    return 'sweeper';
  }

  // Default — fallback
  return 'sweeper';
}
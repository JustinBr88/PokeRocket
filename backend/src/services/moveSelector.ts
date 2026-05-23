import { Types } from 'mongoose';

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
  meta: {
    category: string;
    healing: number;
    drain: number;
    ailment: string;
    statChanges: Array<{ stat: string; change: number }>;
    target?: { name: string };
  };
}

// Field move categories and targets to exclude
const FIELD_CATEGORIES = ['field-effect', 'whole-field-effect'];
const FIELD_TARGETS = ['opponents-field', 'all-opponents', 'all-pokemon'];

// Category labels for debugging
type MoveCategory = 'healing' | 'setup' | 'ailment' | 'debuff' | 'damaging';

function isFieldMove(move: MoveDocument): boolean {
  const meta = move.meta;
  if (!meta) return false;

  // Check category
  if (FIELD_CATEGORIES.includes(meta.category)) {
    return true;
  }

  // Check target
  if (meta.target?.name && FIELD_TARGETS.includes(meta.target.name)) {
    return true;
  }

  return false;
}

function categorizeMove(move: MoveDocument): MoveCategory {
  const meta = move.meta || {};

  // Healing (direct heal or drain)
  if ((meta.healing ?? 0) > 0 || (meta.drain ?? 0) > 0) {
    return 'healing';
  }

  // Setup (stat increases)
  if (meta.statChanges?.some((s) => s.change > 0)) {
    return 'setup';
  }

  // Ailment (applies status condition)
  if (meta.ailment && meta.ailment !== 'none') {
    return 'ailment';
  }

  // Debuff (lowers enemy stats)
  if (meta.statChanges?.some((s) => s.change < 0)) {
    return 'debuff';
  }

  // Damaging (has power and is not status)
  if ((move.power ?? 0) > 0 && move.damageClass !== 'status') {
    return 'damaging';
  }

  // Fallback: status moves that aren't healing/setup/ailment/debuff
  // Treat as damaging for selection purposes
  return 'damaging';
}

function scoreMove(move: MoveDocument): number {
  const accuracy = move.accuracy ?? 100;
  const power = move.power ?? 50;
  return accuracy * power;
}

/**
 * Select the top N most famous/popular moves for a Pokemon.
 * - Excludes field moves (Stealth Rock, Spikes, Reflect, etc.)
 * - Prioritizes category diversity: healing > setup > ailment > debuff > damaging
 * - Within each category, selects by score (accuracy * power)
 */
export function selectTopMoves(
  moves: MoveDocument[],
  count: number = 4
): MoveDocument[] {
  // Filter out field moves
  const nonFieldMoves = moves.filter((m) => !isFieldMove(m));

  if (nonFieldMoves.length === 0) {
    return [];
  }

  // Categorize all moves
  const categorized: Record<MoveCategory, MoveDocument[]> = {
    healing: [],
    setup: [],
    ailment: [],
    debuff: [],
    damaging: [],
  };

  for (const move of nonFieldMoves) {
    const cat = categorizeMove(move);
    categorized[cat].push(move);
  }

  // Sort each category by score (descending)
  for (const cat of Object.keys(categorized) as MoveCategory[]) {
    categorized[cat].sort((a, b) => scoreMove(b) - scoreMove(a));
  }

  // Select moves prioritizing category diversity
  const selected: MoveDocument[] = [];
  const categories: MoveCategory[] = ['healing', 'setup', 'ailment', 'debuff', 'damaging'];

  // First pass: pick 1 from each category that has moves
  for (const cat of categories) {
    if (selected.length >= count) break;
    if (categorized[cat].length > 0) {
      selected.push(categorized[cat].shift()!);
    }
  }

  // Second pass: fill remaining slots with highest scoring damaging moves
  if (selected.length < count) {
    const remaining = [
      ...categorized.damaging,
      ...categorized.debuff,
      ...categorized.ailment,
      ...categorized.setup,
      ...categorized.healing,
    ];
    remaining.sort((a, b) => scoreMove(b) - scoreMove(a));

    for (const move of remaining) {
      if (selected.length >= count) break;
      // Avoid duplicates
      if (!selected.find((m) => m._id.equals(move._id))) {
        selected.push(move);
      }
    }
  }

  return selected.slice(0, count);
}
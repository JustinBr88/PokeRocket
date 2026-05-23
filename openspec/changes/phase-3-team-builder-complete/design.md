# Design: Phase 3 — Team Builder Complete

## Technical Approach

Phase 3 extends the import pipeline with meta-aware move classification, introduces role detection and move selection services, and surfaces role-filtered APIs. On the frontend, it adds a Move Picker Modal, Role Badges, and role filter buttons to the Team Builder. The system remains consistent with the Gen 5 battle rules documented in AGENTS.md.

---

## Architecture Decisions

### Decision: Role detection priority order

**Choice**: Support > Buffer > Status_applier > Debuffer > Tank > Sweeper

**Rationale**: Healing moves are rare and highly defining (Soft-Boiled, Absorb). Setup/buff moves similarly define a Pokemon's strategy. Status application and debuffing are distinct categories. Tank and Sweeper are defaults based on stats or raw power.

### Decision: `meta.statChanges` as array

**Choice**: Store stat changes as `Array<{ stat: string; change: number }>` not a flat object

**Rationale**: Some moves affect multiple stats (Dragon Dance: attack+speed). The array preserves all changes for accurate scoring and detection.

### Decision: Scoring `accuracy * (power ?? 50)`

**Choice**: Use `(accuracy ?? 100) * (power ?? 50)` as move popularity score

**Rationale**: Rewards accurate powerful moves. Null power (status moves) get a neutral score of 50. Null accuracy (always-hit) gets treated as 100.

### Decision: Category diversity before top scoring in move selection

**Choice**: Select 1 healing → 1 setup → 1 ailment → 1 debuff → fill with damaging

**Rationale**: A Pokemon with healing should have healing. A setup Pokemon should have setup. This ensures the selected 4 moves each serve a distinct tactical purpose.

### Decision: Import stores only 4 moves per Pokemon

**Choice**: After importing all moves, run `selectTopMoves(moves, 4)` and store only those 4

**Rationale**: Matches battle system (exactly 4 moves per Pokemon in combat). The full move list remains available via `GET /api/pokemon/:id/moves` if needed later.

---

## Data Flow

### Import Pipeline

```
PokéAPI → importMove(url) → MoveModel (with meta)
                                    ↓
PokemonModel.findOneAndUpdate(..., {
  moveIds: selectTopMoves(allMoves, 4),
  role: detectRole(allMoves, baseStats)
})
```

### Team Builder Flow

```
User clicks Pokemon → searchPokemon(?role=X) → PokemonAPI[]
User clicks move slot → getPokemon(id) → moveIds[]
MovePickerModal → select 4 moves → updateMoves(index, [ids]) → teamStore
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/types/role.ts` | **Create** | Shared types: `Role`, `MoveMeta`, `BaseStats`, `MoveWithMeta` |
| `backend/src/services/roleDetection.ts` | **Create** | `detectRole(moves, baseStats): Role` |
| `backend/src/services/moveSelector.ts` | **Create** | `selectTopMoves(moves, count?): Move[]` |
| `backend/src/routes/pokemon.ts` | **Modify** | Add `role` query param filter to `GET /api/pokemon` |
| `backend/src/scripts/importFromPokeAPI.ts` | **Modify** | Extract meta fields, call role/move services, store only 4 moves |
| `frontend/src/types/index.ts` | **Modify** | Add `role?: string` to `PokemonAPI` |
| `frontend/src/app/components/MovePickerModal.tsx` | **Create** | Move selection modal |
| `frontend/src/app/components/RoleBadge.tsx` | **Create** | Role-colored pill badge |
| `frontend/src/app/routes/teams.tsx` | **Modify** | Add role filter bar, integrate MovePickerModal, wire store actions |

---

## TypeScript Interfaces

### Backend — `backend/src/types/role.ts`

```typescript
export type Role = 'sweeper' | 'buffer' | 'support' | 'status_applier' | 'tank' | 'debuffer';

export interface MoveMeta {
  category: string;
  healing: number;
  drain: number;
  ailment: string;
  statChanges: Array<{ stat: string; change: number }>;
}

export interface MoveWithMeta extends Document {
  meta: MoveMeta;
  pokeApiId: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: 'physical' | 'special' | 'status';
  effect: string;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}
```

### Backend — `backend/src/services/roleDetection.ts`

```typescript
import type { MoveWithMeta, BaseStats, Role } from '../types/role';

export function detectRole(moves: MoveWithMeta[], baseStats: BaseStats): Role {
  if (moves.length === 0) return 'sweeper';

  // 1. Support: any healing or drain
  const hasHealing = moves.some(m => m.meta.healing > 0 || m.meta.drain > 0);
  if (hasHealing) return 'support';

  // 2. Buffer: >=2 setup moves (stat increase)
  const setupCount = moves.filter(m =>
    m.meta.statChanges.some(s => s.change > 0)
  ).length;
  if (setupCount >= 2) return 'buffer';

  // 3. Status Applier: >=2 ailment moves
  const ailmentCount = moves.filter(m => m.meta.ailment !== 'none').length;
  if (ailmentCount >= 2) return 'status_applier';

  // 4. Debuffer: >=2 debuff moves (stat decrease)
  const debuffCount = moves.filter(m =>
    m.meta.statChanges.some(s => s.change < 0)
  ).length;
  if (debuffCount >= 2) return 'debuffer';

  // 5. Tank: high HP + defense, no other role
  if (baseStats.hp > 90 && baseStats.defense > 85) return 'tank';

  // 6. Sweeper: >=2 strong moves (power > 70)
  const strongCount = moves.filter(m => (m.power ?? 0) > 70).length;
  if (strongCount >= 2) return 'sweeper';

  return 'sweeper';
}
```

### Backend — `backend/src/services/moveSelector.ts`

```typescript
import type { MoveWithMeta } from '../types/role';

const FIELD_CATEGORIES = ['field-effect', 'whole-field-effect'];
const FIELD_TARGETS = ['opponents-field', 'all-opponents', 'all-pokemon'];

type MoveCategory = 'healing' | 'setup' | 'ailment' | 'debuff' | 'damaging';

function categorizeMove(m: MoveWithMeta): MoveCategory | null {
  if (m.meta.healing > 0 || m.meta.drain > 0) return 'healing';
  if (m.meta.statChanges.some(s => s.change > 0)) return 'setup';
  if (m.meta.ailment !== 'none') return 'ailment';
  if (m.meta.statChanges.some(s => s.change < 0)) return 'debuff';
  if (m.power !== null && m.damageClass !== 'status') return 'damaging';
  return null;
}

function scoreMove(m: MoveWithMeta): number {
  return (m.accuracy ?? 100) * (m.power ?? 50);
}

export function selectTopMoves(moves: MoveWithMeta[], count: number = 4): MoveWithMeta[] {
  // 1. Filter out field moves
  const nonField = moves.filter(m =>
    !FIELD_CATEGORIES.includes(m.meta.category) &&
    !FIELD_TARGETS.includes((m as any).target?.name ?? '')
  );

  // 2. Score all moves
  const scored = nonField.map(m => ({ m, score: scoreMove(m) }));

  // 3. Pick 1 from each priority category, then fill with highest scoring damaging
  const categories: MoveCategory[] = ['healing', 'setup', 'ailment', 'debuff'];
  const selected: MoveWithMeta[] = [];

  for (const cat of categories) {
    const candidates = scored
      .filter(({ m }) => categorizeMove(m) === cat && !selected.includes(m.m))
      .sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      selected.push(candidates[0].m);
    }
  }

  // 4. Fill remaining slots with highest scoring moves
  const remaining = count - selected.length;
  if (remaining > 0) {
    const remainingScored = scored
      .filter(({ m }) => !selected.includes(m))
      .sort((a, b) => b.score - a.score);
    selected.push(...remainingScored.slice(0, remaining).map(s => s.m));
  }

  return selected.slice(0, count);
}
```

### Backend — `backend/src/routes/pokemon.ts` (diff)

```diff
- const { q, type, legendary, page = '1', limit = '30' } = c.req.query();
+ const { q, type, legendary, role, page = '1', limit = '30' } = c.req.query();
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: 'i' };
  if (type) filter.types = type;
  if (legendary === 'true') filter.isLegendary = true;
  if (legendary === 'false') filter.isLegendary = false;
+ if (role) filter.role = role;
```

### Backend — `backend/src/scripts/importFromPokeAPI.ts` (key changes)

```typescript
// In importMove(): extract meta from PokéAPI response
const move = await MoveModel.create({
  pokeApiId: data.id,
  name: data.name,
  type: data.type.name,
  power: data.power ?? null,
  accuracy: data.accuracy ?? null,
  priority: data.priority ?? 0,
  damageClass: data.damage_class.name,
  effect: data.effect_entries?.find((e: any) => e.language.name === 'en')?.short_effect ?? '',
+ meta: {
+   category: data.meta?.category ?? 'damage',
+   healing: data.meta?.healing ?? 0,
+   drain: data.meta?.drain ?? 0,
+   ailment: data.meta?.ailment ?? 'none',
+   statChanges: data.stat_changes?.map((s: any) => ({
+     stat: s.stat.name,
+     change: s.change,
+   })) ?? [],
+ },
+ // Store target for field move detection
+ target: data.target,
});

// After importing all moves for a Pokemon:
const importedMoves = await MoveModel.find({ _id: { $in: moveIds } }).lean();
const { detectRole } = await import('./services/roleDetection.js');
const { selectTopMoves } = await import('./services/moveSelector.js');

const role = detectRole(importedMoves, statsMap);
const top4 = selectTopMoves(importedMoves, 4);

await PokemonModel.findOneAndUpdate(
  { pokedexId: data.id },
  {
    role,
    moveIds: top4.map(m => m._id),
    // ... rest of upsert fields
  },
);
```

### Frontend — `frontend/src/types/index.ts` (diff)

```diff
export interface PokemonAPI {
  // ... existing fields
+ role?: string;
}
```

### Frontend — `frontend/src/app/components/RoleBadge.tsx`

```tsx
import type { Role } from '../../../types/role';

const ROLE_COLORS: Record<Role, string> = {
  sweeper: '#ef4444',
  buffer: '#3b82f6',
  support: '#22c55e',
  status_applier: '#a855f7',
  tank: '#6b7280',
  debuffer: '#f97316',
};

const ROLE_LABELS: Record<Role, string> = {
  sweeper: 'Sweeper',
  buffer: 'Buffer',
  support: 'Support',
  status_applier: 'Status',
  tank: 'Tank',
  debuffer: 'Debuffer',
};

interface Props {
  role: string;
}

export function RoleBadge({ role }: Props) {
  if (!role || !(role in ROLE_COLORS)) return null;
  const color = ROLE_COLORS[role as Role];
  const label = ROLE_LABELS[role as Role] ?? role;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-label-sm uppercase border"
      style={{ backgroundColor: color, borderColor: color, color: '#fff' }}
    >
      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
        {role === 'support' ? 'healing' : role === 'tank' ? 'shield' : 'speed'}
      </span>
      {label}
    </span>
  );
}
```

### Frontend — `frontend/src/app/components/MovePickerModal.tsx`

```tsx
interface Move {
  _id: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  damageClass: string;
  meta: { category: string; healing: number; drain: number; ailment: string };
}

interface Props {
  pokemonId: number;
  availableMoves: Move[];
  selectedMoves: number[];
  onConfirm: (moveIds: number[]) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { key: 'healing', label: 'Healing', icon: 'healing' },
  { key: 'setup', label: 'Setup', icon: 'trending_up' },
  { key: 'ailment', label: 'Status', icon: 'warning' },
  { key: 'debuff', label: 'Debuff', icon: 'arrow_downward' },
  { key: 'damaging', label: 'Damaging', icon: 'bolt' },
] as const;

function categorizeMove(m: Move): string {
  if (m.meta.healing > 0 || m.meta.drain > 0) return 'healing';
  if (m.meta.statChanges?.some((s: any) => s.change > 0)) return 'setup';
  if (m.meta.ailment !== 'none') return 'ailment';
  if (m.meta.statChanges?.some((s: any) => s.change < 0)) return 'debuff';
  return 'damaging';
}

export function MovePickerModal({ availableMoves, selectedMoves, onConfirm, onClose }: Props) {
  const [selection, setSelection] = useState<number[]>(selectedMoves);

  function toggleMove(id: number) {
    setSelection(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface-container border-4 border-black w-[600px] max-h-[80vh] flex flex-col chamfer-tl">
        {/* Header */}
        <div className="bg-surface-container-high border-b-4 border-black p-4 flex justify-between items-center">
          <span className="font-headline text-headline-md text-primary uppercase">Select 4 Moves</span>
          <button onClick={onClose} className="material-symbols-outlined text-primary">close</button>
        </div>

        {/* Body — category tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          {CATEGORIES.map(cat => {
            const moves = availableMoves.filter(m => categorizeMove(m) === cat.key);
            if (moves.length === 0) return null;
            return (
              <div key={cat.key} className="mb-6">
                <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                  {cat.label}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {moves.map(move => (
                    <button
                      key={move._id}
                      onClick={() => toggleMove(Number(move._id))}
                      className={`p-2 border-3 border-black text-left chamfer-tl transition-all ${
                        selection.includes(Number(move._id))
                          ? 'bg-primary border-primary'
                          : 'bg-surface-container-lowest hover:bg-surface-container'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-label-sm text-label-sm text-on-surface uppercase truncate">{move.name}</span>
                        {selection.includes(Number(move._id)) && (
                          <span className="material-symbols-outlined text-sm text-white">check</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className={`type-${move.type.toLowerCase()} text-[8px] px-1 border border-black uppercase`}>{move.type}</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {move.power != null ? `PWR ${move.power}` : '—'}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {move.accuracy != null ? `ACC ${move.accuracy}` : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-surface-container-high border-t-4 border-black p-4 flex justify-between items-center">
          <span className="font-label-lg text-label-lg text-on-surface-variant">
            {selection.length}/4 selected
          </span>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-2 border-3 border-black font-label-lg uppercase chamfer-tl hover:bg-surface transition-colors">
              CANCEL
            </button>
            <button
              onClick={() => onConfirm(selection)}
              disabled={selection.length !== 4}
              className="bg-primary text-on-primary px-6 py-2 border-3 border-black font-label-lg uppercase chamfer-br hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## API Endpoint Changes

### `GET /api/pokemon`

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Name search regex |
| `type` | string | Single type filter |
| `legendary` | boolean | Filter by isLegendary |
| `role` | string | Role enum value |
| `page` | number | Pagination |
| `limit` | number | Results per page |

### `GET /api/pokemon/:id`

Returns full Pokemon with populated `moveIds[]` array. Each move document includes `meta` fields.

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `detectRole()` edge cases | Jest with mock move arrays |
| Unit | `selectTopMoves()` filtering and scoring | Jest with 20-move mock set |
| Integration | `GET /api/pokemon?role=support` | Supertest, verify filter |
| Integration | Import script updates role/moveIds | Run import on staging DB, query results |
| E2E | Full team builder flow | Playwright: add Pokemon → select moves → confirm team |

---

## Open Questions

- [ ] Should `GET /api/pokemon/:id` return only the 4 stored moves or all imported moves?
- [ ] Ability selection UI: dropdown with known abilities from a hardcoded list (Phase 8), or fetched from API?

---

## Next Step

Ready for tasks (sdd-tasks).
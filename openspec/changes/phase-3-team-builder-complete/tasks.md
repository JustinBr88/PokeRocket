# Tasks: Phase 3 — Team Builder Complete

## Phase 1: Backend Types & Schema

- [ ] **T1 — Add meta fields to MoveModel schema**
  - File: `backend/src/models/index.ts`
  - Action: Verify `meta` subdocument in `MoveSchema` has all required fields: `category (String)`, `healing (Number, default 0)`, `drain (Number, default 0)`, `ailment (String, default 'none')`, `statChanges ([{stat: String, change: Number}])`
  - Dependencies: None
  - Verification: Run `npx tsc --noEmit` on backend, ensure no TypeScript errors

---

## Phase 2: Backend Services

- [ ] **T2 — Create role detection service**
  - File: `backend/src/services/roleDetection.ts` (new)
  - Action: Create `detectRole(moves, baseStats): Role` using priority: support → buffer → status_applier → debuffer → tank → sweeper
  - Dependencies: T1
  - Verification: Unit test with mock move arrays covering all 7 scenarios from spec

- [ ] **T3 — Create move selector service**
  - File: `backend/src/services/moveSelector.ts` (new)
  - Action: Create `selectTopMoves(moves, count=4): Move[]` filtering field moves, scoring by `accuracy * power`, selecting 1 per priority category then filling with damaging
  - Dependencies: T1, T2
  - Verification: Unit test with 20-mock-move set, verify exactly 4 returned and field moves excluded

- [ ] **T5 — Add role filter to GET /api/pokemon**
  - File: `backend/src/routes/pokemon.ts`
  - Action: Add optional `role` query param, filter `{ role: query.role }` when present
  - Dependencies: T1
  - Verification: `GET /api/pokemon?role=support` returns only support Pokemon

- [ ] **T6 — Run migration for existing 300 Pokemon**
  - File: `backend/src/scripts/reimportAllPokemon.ts` (new)
  - Action: Create idempotent script that re-imports all Pokemon with meta-aware logic, adds 100ms delay between requests
  - Dependencies: T2, T3, T4
  - Verification: Query `db.pokemon.find({role: {$exists: true}}).count()` returns 300

---

## Phase 3: Backend Import Pipeline

- [ ] **T4 — Update import script to populate meta fields**
  - File: `backend/src/scripts/importFromPokeAPI.ts`
  - Action: Modify `importMove()` to fetch full move data and save meta fields; after importing all moves for a Pokemon, call `detectRole()` and `selectTopMoves(4)`, update Pokemon upsert with role and only 4 selected moveIds
  - Dependencies: T2, T3
  - Verification: Run `npm run import` on a single Pokemon, verify Move doc has meta fields and Pokemon doc has role + 4 moveIds

---

## Phase 4: Frontend Types & Components

- [ ] **T7 — Add role to PokemonAPI type**
  - File: `frontend/src/types/index.ts`
  - Action: Add `role?: string` to `PokemonAPI` interface
  - Dependencies: None
  - Verification: TypeScript compilation passes, `PokemonAPI` instances accept `role` field

- [ ] **T8 — Create RoleBadge component**
  - File: `frontend/src/app/components/RoleBadge.tsx` (new)
  - Action: Create pill badge with color map: sweeper=#ef4444, buffer=#3b82f6, support=#22c55e, status_applier=#a855f7, tank=#6b7280, debuffer=#f97316
  - Dependencies: T7
  - Verification: Render `<RoleBadge role="support" />` shows green badge with "Support" label

---

## Phase 5: Frontend Move Picker Modal

- [ ] **T9 — Create MovePickerModal component**
  - File: `frontend/src/app/components/MovePickerModal.tsx` (new)
  - Action: Create modal with moves grouped by category (Healing/Setup/Status/Debuff/Damaging), Confirm disabled until exactly 4 selected, shows type badge/power/accuracy/effect
  - Dependencies: T7, T8
  - Verification: Open modal, select 4 moves, Confirm becomes enabled; click Confirm, modal closes

- [ ] **T12 — Wire up MovePickerModal to team store**
  - File: `frontend/src/app/routes/teams.tsx`
  - Action: On move slot click open MovePickerModal; on confirm call `updateMoves(index, selectedMoveIds)`, persist to store
  - Dependencies: T9
  - Verification: Select moves → refresh page → moves still selected in store

---

## Phase 6: Frontend Role Filter & Team Validation

- [ ] **T10 — Add role filter buttons to Team Builder**
  - File: `frontend/src/app/routes/teams.tsx`
  - Action: Add row above Pokemon grid: All | Sweeper | Buffer | Support | Status | Tank | Debuffer; active state highlighted; calls `GET /api/pokemon?role=X`
  - Dependencies: T8
  - Verification: Click "Support" → grid shows only support Pokemon; click "All" → all Pokemon shown

- [ ] **T11 — Add role badge to Pokemon cards in Team Builder**
  - File: `frontend/src/app/routes/teams.tsx` (or `PokemonCard.tsx`)
  - Action: Display `RoleBadge` next to Pokemon name; hide if role undefined
  - Dependencies: T8, T10
  - Verification: Pokemon with role shows colored badge; Pokemon without role shows no badge

- [ ] **T13 — Add team completeness validation**
  - File: `frontend/src/app/routes/teams.tsx`
  - Action: "CONFIRM TEAM" button shows warning if team < 6 Pokemon OR any Pokemon has < 4 moves; disable navigation until complete
  - Dependencies: T12
  - Verification: Team with 5 Pokemon → button disabled + warning; Team with 6 Pokemon (4 moves each) → navigation works

---

## Implementation Order

```
Backend:  T1 → T2 → T3 → T5 → T4 → T6
                     ↑     ↑
                     |     └── T5 (pokemon routes) does NOT depend on T4
                     └── T2,T3 (services) must exist before T4 (import update)

Frontend: T7 → T8 → T9 → T12 → T10,T11 → T13
                ↑    ↑                    ↑
                |    └── T9 does NOT depend on T8 (RoleBadge) for logic
                └── T8 (RoleBadge) needed for T10 (filter buttons display)
```

**Critical path:** T1 → T2 → T3 → T4 (import pipeline is the longest chain)

---

## Verification Summary

| Task | Check |
|------|-------|
| T1 | `tsc --noEmit` clean |
| T2 | Jest: all 7 role detection scenarios |
| T3 | Jest: field moves excluded, exactly 4 returned |
| T4 | Manual: `importMove()` saves meta, Pokemon has role + 4 moveIds |
| T5 | `GET /api/pokemon?role=support` returns filtered results |
| T6 | MongoDB: 300 Pokemon with role field |
| T7 | TypeScript accepts `role` on PokemonAPI |
| T8 | Renders colored pill badge |
| T9 | Modal opens, selecting 4 enables Confirm |
| T10 | Filter buttons call API and update grid |
| T11 | Badge visible on cards with role |
| T12 | Moves persist in store across renders |
| T13 | Button disabled + warning for incomplete teams |
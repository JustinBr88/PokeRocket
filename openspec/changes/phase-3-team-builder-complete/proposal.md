# Proposal: Phase 3 — Team Builder Complete

## Intent

Phase 3 fixes the broken import pipeline so Pokémon moves carry their full meta data (category, healing, drain, ailment, statChanges), then surfaces role detection and move selection to both backend API and frontend Team Builder UI.

## Scope

### In Scope
- Fix `importFromPokeAPI.ts` to fetch and save move meta fields
- New `roleDetection.ts` service using the algorithm from AGENTS.md
- New `moveSelector.ts` service that selects top 4 non-field moves per Pokémon
- `POST /api/pokemon/:id/detect-role` — run detection and save role to DB
- `GET /api/pokemon?role=` — filter by role
- Add `role` to frontend `PokemonAPI` type
- Team Builder UI: move picker modal + wire `updateMoves`/`updateAbility`
- Role badge display on Pokemon cards in Team Builder

### Out of Scope
- Draft mode (Phase 7)
- Battle animations (Phase 6)
- ELO ranking (Phase 10)
- Any changes to battle engine or WebSocket logic

## Approach

**Backend:** Fix the import script to hit the `/moves/{id}` endpoint for each move, extract `meta` (category, healing, drain, ailment, statChanges), and save it. After all moves are saved for a Pokemon, call `detectRole()` and update the Pokemon document with its computed role. Expose a filter query param on the list endpoint.

**Frontend:** Extend the `PokemonAPI` TypeScript interface with `role`. Build a move picker modal (4 slots) that filters moves by the selected Pokemon's available moves, sorted by the scoring algorithm. Wire Zustand store actions so selecting moves or ability actually persists to team state.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/scripts/importFromPokeAPI.ts` | Modified | Fetch move meta, call role detection, select top 4 moves |
| `backend/src/services/roleDetection.ts` | New | detectRole(moves, baseStats): Role |
| `backend/src/services/moveSelector.ts` | New | selectTopMoves(moves, count): Move[] |
| `backend/src/routes/pokemon.ts` | Modified | Add `?role=` query filter |
| `backend/src/models/index.ts` | Modified | Ensure meta subdocument is saved |
| `frontend/src/types/index.ts` | Modified | Add `role` to PokemonAPI |
| `frontend/src/stores/teamStore.ts` | Modified | (already has methods — verify they're correct) |
| `frontend/src/app/routes/teams.tsx` | Modified | Move picker modal, role badge, wire store |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PokéAPI rate limit during re-import | Medium | Add 100-200ms delay between move fetches; batch if needed |
| Existing 300 Pokemon with stale move data | High | Write a targeted migration script for moves only, don't re-import all Pokemon |
| Role detection misclassifies edge cases | Medium | Log edge cases; make detection re-runnable via API endpoint |

## Rollback Plan

1. Revert import script to previous version
2. Migration script sets `role` to `null` on all Pokemon documents
3. Frontend `role` field is optional (`?string`) — gracefully degrades if backend doesn't provide it

## Dependencies

- PokéAPI `/move/{id}` endpoint must be accessible
- MongoDB migration capable
- Frontend already has `teamStore.ts` with `updateMoves`/`updateAbility` — verify before wiring

## Success Criteria

- [ ] Import re-run produces Pokemon documents with `role` field populated
- [ ] `GET /api/pokemon?role=sweeper` returns only sweepers
- [ ] Team Builder move picker lets user select exactly 4 moves per Pokemon
- [ ] Role badge visible on Pokemon cards in Team Builder grid
- [ ] Selecting moves/ability in UI persists to Zustand store
# Delta for Backend — Phase 3: Team Builder Complete

## Purpose

Enhance the import pipeline to populate move `meta` fields (category, healing, drain, ailment, statChanges), introduce role detection and move selection services, and expose a role-filtered Pokemon list API.

---

## ADDED Requirements

### Requirement: Move Meta Fields

The `MoveModel` schema MUST store `meta.category`, `meta.healing`, `meta.drain`, `meta.ailment`, and `meta.statChanges` as defined in the schema.

#### Scenario: Full move meta import

- GIVEN PokéAPI `/api/v2/move/{id}` endpoint returns move data with `meta` block
- WHEN `importMove()` is called for that move URL
- THEN the saved Move document MUST contain all `meta` fields populated from the API response
- AND subsequent queries on `MoveModel` MUST return those fields

#### Scenario: Move without meta block

- GIVEN a move API response with no `meta` block (rare edge case)
- WHEN `importMove()` processes it
- THEN `meta` fields MUST default to: `category: 'damage'`, `healing: 0`, `drain: 0`, `ailment: 'none'`, `statChanges: []`

#### Scenario: Move stat changes parsing

- GIVEN a move with `stat_changes: [{stat: {name: 'attack'}, change: 1}, {stat: {name: 'defense'}, change: -1}]`
- WHEN the move is saved
- THEN `meta.statChanges` MUST be stored as `[{stat: 'attack', change: 1}, {stat: 'defense', change: -1}]`

---

### Requirement: Role Detection Service

A new file `backend/src/services/roleDetection.ts` MUST export `detectRole(moves: Move[], baseStats: BaseStats): Role`.

#### Scenario: Support detection (healing)

- GIVEN a Pokemon with moves where any move has `meta.healing > 0` OR `meta.drain > 0`
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'support'`

#### Scenario: Buffer detection (setup)

- GIVEN a Pokemon with at least 2 moves where `meta.statChanges` contains a positive change for any stat
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'buffer'`

#### Scenario: Status Applicr detection

- GIVEN a Pokemon with at least 2 moves where `meta.ailment !== 'none'`
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'status_applier'`

#### Scenario: Debuffer detection

- GIVEN a Pokemon with at least 2 moves where `meta.statChanges` contains a negative change for any stat
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'debuffer'`

#### Scenario: Tank detection

- GIVEN a Pokemon where `baseStats.hp > 90` AND `baseStats.defense > 85`
- AND the Pokemon does NOT qualify for support, buffer, status_applier, or debuffer
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'tank'`

#### Scenario: Sweeper detection (default)

- GIVEN a Pokemon with at least 2 moves that have `power > 70`
- AND the Pokemon does NOT qualify for any higher-priority role
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'sweeper'`

#### Scenario: Default fallback

- GIVEN a Pokemon that does NOT match any role criteria
- WHEN `detectRole()` is called
- THEN the returned role MUST be `'sweeper'`

---

### Requirement: Move Selection Service

A new file `backend/src/services/moveSelector.ts` MUST export `selectTopMoves(moves: Move[], count?: number): Move[]`.

#### Scenario: Filter field moves

- GIVEN a list of moves including Stealth Rock, Earthquake, and Toxic
- WHEN `selectTopMoves(moves, 4)` is called
- THEN Stealth Rock MUST be excluded (field-effect)
- AND the result MUST contain only non-field moves

#### Scenario: Score and sort by priority

- GIVEN 20 non-field moves for a Pokemon
- WHEN `selectTopMoves(moves, 4)` is called
- THEN moves MUST be selected maximizing category diversity
- AND the result MUST contain exactly 4 moves

#### Scenario: Category diversity priority

- GIVEN a Pokemon has moves in multiple categories: healing, setup, ailment, debuff, damaging
- WHEN `selectTopMoves(moves, 4)` is called
- THEN the selection MUST prioritize: healing > setup > ailment > debuff > damaging

#### Scenario: Default count is 4

- GIVEN a list of 10 non-field moves
- WHEN `selectTopMoves(moves)` is called with no count specified
- THEN exactly 4 moves MUST be returned

---

### Requirement: Role Filter API

`GET /api/pokemon` MUST support a `role` query parameter.

#### Scenario: Filter by single role

- GIVEN Pokemon documents with various `role` values in the database
- WHEN a client sends `GET /api/pokemon?role=sweeper`
- THEN the response MUST contain ONLY Pokemon where `role === 'sweeper'`

#### Scenario: No role param returns all

- GIVEN `role` query param is not provided
- WHEN `GET /api/pokemon` is called
- THEN all Pokemon (including those with null role) MUST be returned

---

### Requirement: Import Script Integration

The `importFromPokeAPI.ts` script MUST call role detection and move selection after importing moves.

#### Scenario: Store only top 4 moves

- GIVEN a Pokemon has 20 imported move IDs
- WHEN the Pokemon upsert is called
- THEN `moveIds` in the document MUST contain only the 4 selected moves from `selectTopMoves()`

#### Scenario: Store detected role

- GIVEN a Pokemon has been processed with all its moves imported
- WHEN the Pokemon upsert is called
- THEN the document MUST include `role: detectedRole` where `detectedRole` is the result of `detectRole()`

---

## MODIFIED Requirements

### Requirement: Import Move (extended)

The `importMove()` function in `backend/src/scripts/importFromPokeAPI.ts` MUST now also fetch and save `meta` fields.

(Previously: Only saved `pokeApiId`, `name`, `type`, `power`, `accuracy`, `priority`, `damageClass`, `effect`)

#### Scenario: Move with full meta data

- GIVEN a move URL for a move like Soft-Boiled that has `meta.healing: 50`, `meta.ailment: 'none'`
- WHEN `importMove(url)` is called
- THEN all meta fields MUST be saved to the Move document
- AND the function MUST return the move ID as before

---

## REMOVED Requirements

None.

---

## Notes

- Rate limiting: import script SHOULD add 100ms delay between move fetches to avoid PokéAPI rate limits
- The `detectRole()` function takes moves as `Move[]` (populated Mongoose documents or lean objects)
- Role detection is re-runnable — re-importing updates the role field
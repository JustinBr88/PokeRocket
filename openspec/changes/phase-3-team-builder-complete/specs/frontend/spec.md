# Delta for Frontend — Phase 3: Team Builder Complete

## Purpose

Extend the Team Builder UI with a Move Picker Modal for selecting exactly 4 moves per Pokemon, display role badges on Pokemon cards, add a role filter, and wire `updateMoves`/`updateAbility` store actions end-to-end.

---

## ADDED Requirements

### Requirement: Move Picker Modal

When a user clicks on a Pokemon's move slots in the Team Builder, a modal MUST open allowing selection of exactly 4 moves.

#### Scenario: Open modal for Pokemon

- GIVEN a Pokemon is selected in the Team Builder
- WHEN the user clicks on the moves area of that Pokemon's card
- THEN a modal MUST open showing all available moves for that Pokemon fetched from `GET /api/pokemon/:id`

#### Scenario: Moves grouped by category

- GIVEN the move picker modal is open
- WHEN moves are displayed
- THEN moves MUST be visually grouped by category: Healing, Setup, Status, Debuff, Damaging
- AND each group MUST have a clear label

#### Scenario: Select exactly 4 moves

- GIVEN the modal is open and moves are displayed
- WHEN the user clicks on a move to toggle selection
- THEN the move MUST be added to/removed from the selection
- AND selected moves MUST be visually indicated (e.g., highlighted border)

#### Scenario: Confirm disabled until 4 selected

- GIVEN the user has selected fewer than 4 moves
- WHEN the user looks at the Confirm button
- THEN the Confirm button MUST be visually disabled (opacity 50%, non-clickable)

#### Scenario: Confirm enabled at 4 moves

- GIVEN the user has selected exactly 4 moves
- WHEN the user looks at the Confirm button
- THEN the Confirm button MUST be enabled

#### Scenario: Confirm persists to store

- GIVEN the user has selected exactly 4 moves and clicks Confirm
- WHEN Confirm is clicked
- THEN `updateMoves(index, selectedMoveIds[])` MUST be called on the team store
- AND the modal MUST close
- AND the selected move IDs (as numbers) MUST be stored in `currentTeam[index].moves`

#### Scenario: Move shows type, power, accuracy, effect

- GIVEN a move is displayed in the modal
- THEN each move card MUST show: type badge, power (or "—" for status), accuracy (or "—" for status), effect short text

---

### Requirement: Role Badge Display

Pokemon cards in the Team Builder grid MUST display a role badge.

#### Scenario: Badge visible on card

- GIVEN a Pokemon has a `role` field
- WHEN that Pokemon is rendered in the grid
- THEN a role badge MUST be visible on the card

#### Scenario: Badge colors per role

- GIVEN a Pokemon with role `'sweeper'`
- WHEN rendered
- THEN the badge background MUST be red
- AND the badge text MUST display the role name

| Role | Badge Color |
|------|-------------|
| sweeper | red |
| buffer | blue |
| support | green |
| status_applier | purple |
| tank | gray |
| debuffer | orange |

#### Scenario: No badge when role undefined

- GIVEN a Pokemon has `role: undefined` or `role: null`
- WHEN rendered
- THEN NO role badge SHOULD be displayed

---

### Requirement: Role Filter Buttons

A row of filter buttons MUST appear above the Pokemon grid in the Team Builder.

#### Scenario: Filter buttons present

- GIVEN the Team Builder is loaded
- THEN buttons labeled: All | Sweeper | Buffer | Support | Status | Tank | Debuffer MUST be visible above the grid

#### Scenario: Active filter highlighted

- GIVEN the user clicks the "Support" filter button
- WHEN the grid updates
- THEN only Pokemon with `role === 'support'` MUST be displayed
- AND the "Support" button MUST be visually highlighted (accent border or background change)
- AND the other buttons MUST NOT be highlighted

#### Scenario: "All" shows everything

- GIVEN a role filter is active
- WHEN the user clicks "All"
- THEN ALL Pokemon (regardless of role) MUST be displayed
- AND no filter button should be highlighted

#### Scenario: Role filter integrates with existing search

- GIVEN the user has entered a search query and selected a type filter
- WHEN they additionally apply a role filter
- THEN all three filters (search text, type, role) MUST be combined in the API request

---

### Requirement: Ability Selection

Users MUST be able to select an ability for each Pokemon in their team.

#### Scenario: Ability field in store

- GIVEN a Pokemon is added to `currentTeam`
- WHEN the user selects an ability for that Pokemon
- THEN `updateAbility(index, abilityName)` MUST be called
- AND `currentTeam[index].ability` MUST be updated

#### Scenario: Ability selection UI

- GIVEN a Pokemon is selected in the Team Builder detail panel
- THEN an ability selector SHOULD be displayed (dropdown or list of known abilities)
- AND selecting an ability MUST call `updateAbility()`

#### Scenario: Ability persists to team confirm

- GIVEN a Pokemon has an ability set in the store
- WHEN the team is confirmed and sent to the API
- THEN the ability value MUST be included in the request payload

---

### Requirement: Team Store updateMoves

The `updateMoves` action in `teamStore.ts` MUST accept move IDs and persist them correctly.

#### Scenario: Update moves at index

- GIVEN `currentTeam` has a Pokemon at index 2 with `moves: []`
- WHEN `updateMoves(2, [25, 42, 68, 99])` is called
- THEN `currentTeam[2].moves` MUST equal `[25, 42, 68, 99]`

---

### Requirement: PokemonAPI Type Extended

The `PokemonAPI` interface in `frontend/src/types/index.ts` MUST include a `role` field.

#### Scenario: Type includes role

- GIVEN the `PokemonAPI` type is used
- THEN it MUST have an optional field: `role?: string`

---

## MODIFIED Requirements

### Requirement: Pokemon Card in Grid (extended)

(Previously: Pokemon cards displayed name, types, sprite, legendary indicator)

- GIVEN a Pokemon card is rendered in the grid
- WHEN the Pokemon has a `role` value
- THEN a role badge MUST be rendered on the card
- AND the existing elements (name, types, sprite) MUST remain unchanged

---

### Requirement: Team Confirm Button

The "CONFIRM TEAM" button currently navigates to battle without verifying team completeness.

#### Scenario: Verify team completeness before confirm

- GIVEN the user clicks "CONFIRM TEAM"
- WHEN the team has fewer than 6 Pokemon OR any Pokemon has fewer than 4 moves
- THEN the button SHOULD show a warning or be disabled
- AND navigation to battle SHOULD NOT occur

#### Scenario: Team complete navigates to battle

- GIVEN the user clicks "CONFIRM TEAM"
- WHEN the team has exactly 6 Pokemon AND each Pokemon has exactly 4 moves
- THEN navigation to `/battle/:roomId` MUST occur

---

## REMOVED Requirements

None.

---

## Notes

- The move picker modal MUST be accessible from the team sidebar slot view AND from the detail panel
- Role filter calls `GET /api/pokemon?role=X` — the API supports this query param as specified in backend specs
- Wire `updateMoves` and `updateAbility` so they're tested via the full UI flow (add Pokemon → select moves → confirm team)
- Graceful degradation: if backend doesn't return `role` field, no badge is shown (no crash)
---
name: pokemon-bw-ui
description: >
  Design and implement all frontend UI for the Pokémon Battle Rooms project
  using the authentic Generation 5 (Black & White / Black 2 & White 2) visual
  style. Use this skill for every screen: home, create-room, join-room, lobby,
  team-selection, and battle. It covers sprite sourcing, CSS design tokens,
  animation patterns, HUD layout, battle log, and React component structure.
  Trigger when building any page, component, or animation that must look and
  feel like a Nintendo DS Pokémon Black & White battle.
---

# Pokémon Black & White UI Skill

## 1 · Visual identity

The entire app must look like it was ripped from **Pokémon Black & White (Gen 5, NDS)**.
Commit to this 100 %. Never mix in 3-D renders, Scarlet/Violet UI, or any non-Gen-5 asset.

### Design tokens (CSS custom properties)

```css
:root {
  /* ── Palette ─────────────────────────────────────── */
  --bw-black:       #1a1a2e;   /* deep navy-black (menu bg) */
  --bw-dark:        #16213e;
  --bw-panel:       #0f3460;   /* info panels */
  --bw-blue:        #533483;   /* accent / buttons */
  --bw-blue-light:  #7b5ea7;
  --bw-white:       #e8e8e8;
  --bw-off-white:   #c8c8c8;
  --bw-hp-green:    #48d058;
  --bw-hp-yellow:   #f8d030;
  --bw-hp-red:      #f03028;
  --bw-exp:         #60a8f0;
  --bw-text-light:  #f0f0f0;
  --bw-text-shadow: #000;

  /* ── Type colours (Gen 5 palette) ───────────────── */
  --type-normal:   #a8a878; --type-fire:     #f08030;
  --type-water:    #6890f0; --type-electric: #f8d030;
  --type-grass:    #78c850; --type-ice:      #98d8d8;
  --type-fighting: #c03028; --type-poison:   #a040a0;
  --type-ground:   #e0c068; --type-flying:   #a890f0;
  --type-psychic:  #f85888; --type-bug:      #a8b820;
  --type-rock:     #b8a038; --type-ghost:    #705898;
  --type-dragon:   #7038f8; --type-dark:     #705848;
  --type-steel:    #b8b8d0;

  /* ── Typography ─────────────────────────────────── */
  --font-pixel:  'Press Start 2P', monospace;   /* headings, labels */
  --font-ui:     'Noto Sans', sans-serif;        /* body, move names */
  --font-size-xs: 0.55rem;
  --font-size-sm: 0.7rem;
  --font-size-md: 0.9rem;
  --font-size-lg: 1.1rem;

  /* ── Spacing / radii ─────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  /* ── Shadows ─────────────────────────────────────── */
  --shadow-panel: 0 4px 16px rgba(0,0,0,0.6);
  --shadow-text:  1px 1px 0 var(--bw-text-shadow);
}
```

Import fonts in index.html or global CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans:wght@400;700&display=swap" rel="stylesheet">
```

---

## 2 · Sprite sourcing

### Sources (use in this priority order)

| Priority | Source | URL pattern | Format |
|---|---|---|---|
| 1 | Pokémon Showdown animated (front) | `https://play.pokemonshowdown.com/sprites/ani/{name}.gif` | Animated GIF |
| 2 | Pokémon Showdown animated (back) | `https://play.pokemonshowdown.com/sprites/ani-back/{name}.gif` | Animated GIF |
| 3 | Pokémon Showdown shiny | `https://play.pokemonshowdown.com/sprites/ani-shiny/{name}.gif` | Animated GIF |
| 4 | BW icons (team slots) | `https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png` | CSS sprite sheet |
| 5 | PokeAPI fallback (static) | Stored in MongoDB `spriteUrl` field | PNG |

**Name normalisation** — Showdown uses lowercase, hyphens, no special chars:

```ts
function toShowdownName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')       // nidoran♂ → nidoranm
    .replace(/\s+/g, '-')
    .replace(/\./g, '');
}

function getFrontSprite(name: string) {
  return `https://play.pokemonshowdown.com/sprites/ani/${toShowdownName(name)}.gif`;
}
function getBackSprite(name: string) {
  return `https://play.pokemonshowdown.com/sprites/ani-back/${toShowdownName(name)}.gif`;
}
```

**Fallback pattern** (React):

```tsx
<img
  src={getFrontSprite(pokemon.name)}
  onError={e => { (e.target as HTMLImageElement).src = pokemon.spriteUrl; }}
  alt={pokemon.name}
  className="pokemon-sprite"
/>
```

### Recommended public folder layout

```
/public/sprites/
  backgrounds/   ← battle arena backgrounds (Gen 5 rips)
  hud/           ← healthbar frame, namebox, etc.
  icons/         ← type badge images (optional)
```

---

## 3 · Screen layouts

### 3.1 Home / Create / Join

```
┌────────────────────────────────────────┐
│  [LOGO — Press Start 2P, large]        │
│  Pokémon Battle Rooms                  │
│                                        │
│  ┌─────────────┐  ┌─────────────┐     │
│  │ CREATE ROOM │  │  JOIN ROOM  │     │
│  └─────────────┘  └─────────────┘     │
│                                        │
│  [code input — monospace, large]       │
└────────────────────────────────────────┘
```

CSS pattern:

```css
.home-screen {
  min-height: 100vh;
  background: var(--bw-black);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  /* optional: pixelated scanline overlay */
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0.15) 0px,
      rgba(0,0,0,0.15) 1px,
      transparent 1px,
      transparent 2px
    );
}

.bw-btn {
  font-family: var(--font-pixel);
  font-size: var(--font-size-sm);
  background: var(--bw-blue);
  color: var(--bw-white);
  border: 3px solid var(--bw-white);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
  transition: transform 0.1s, box-shadow 0.1s;
}
.bw-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
}
```

### 3.2 Battle screen layout

```
┌─────────────────────────────────────────────────────┐
│ BATTLE ARENA                                        │
│  ┌──────────────────────────────────────────────┐   │
│  │ [OPPONENT NAMEBOX]  [HP BAR]                │   │ ← top HUD
│  └──────────────────────────────────────────────┘   │
│                                                     │
│        [OPPONENT SPRITE — front gif, large]         │
│                                                     │
│  [PLAYER SPRITE — back gif, large]                  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ [PLAYER NAMEBOX]  [HP BAR]  [STATUS BADGE]  │   │ ← bottom HUD
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │  MOVE PANEL     │  │  BATTLE LOG             │   │
│  │  [Move 1] [M2]  │  │  > Pikachu used Surf   │   │
│  │  [Move 3] [M4]  │  │  > It's super effective│   │
│  │  [SWITCH BTN]   │  │  > Charmander fainted! │   │
│  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Key CSS for the arena:

```css
.battle-screen {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  background: var(--bw-dark);
  overflow: hidden;
}

.battle-arena {
  position: relative;
  background-image: url('/sprites/backgrounds/bw-arena.png');
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  min-height: 280px;
}

/* sprites */
.sprite-opponent {
  position: absolute;
  top: 10%;
  right: 10%;
  width: 160px;
  image-rendering: pixelated;
}
.sprite-player {
  position: absolute;
  bottom: 10%;
  left: 10%;
  width: 160px;
  image-rendering: pixelated;
}

/* HP bar */
.hp-bar-track {
  height: 8px;
  background: #333;
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.hp-bar-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--bw-hp-green);
  transition: width 0.5s ease, background 0.5s;
}
.hp-bar-fill[data-pct="yellow"] { background: var(--bw-hp-yellow); }
.hp-bar-fill[data-pct="red"]    { background: var(--bw-hp-red); }
```

HP bar colour logic:

```ts
function hpColor(current: number, max: number) {
  const pct = current / max;
  if (pct > 0.5) return 'green';
  if (pct > 0.25) return 'yellow';
  return 'red';
}
```

### 3.3 Move buttons

```css
.move-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.move-btn {
  font-family: var(--font-pixel);
  font-size: var(--font-size-xs);
  padding: 0.6rem 0.4rem;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: #fff;
  text-transform: uppercase;
  background: var(--type-bg, #555);  /* set via inline style from move type */
  transition: filter 0.15s;
}
.move-btn:hover { filter: brightness(1.2); }
.move-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

Set `style={{ '--type-bg': `var(--type-${move.type})` } as React.CSSProperties}` on each button.

### 3.4 Type badge

```tsx
function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="type-badge"
      style={{ background: `var(--type-${type.toLowerCase()})` }}
    >
      {type.toUpperCase()}
    </span>
  );
}
```

```css
.type-badge {
  font-family: var(--font-pixel);
  font-size: 0.45rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: #fff;
  text-shadow: var(--shadow-text);
  white-space: nowrap;
}
```

### 3.5 Status badge

```tsx
const STATUS_COLORS: Record<string, string> = {
  burn:    '#f08030',
  poison:  '#a040a0',
  paralyze:'#f8d030',
  sleep:   '#705848',
  freeze:  '#98d8d8',
};

function StatusBadge({ status, turnsLeft }: { status: string; turnsLeft: number }) {
  return (
    <span className="status-badge" style={{ background: STATUS_COLORS[status] ?? '#888' }}>
      {status.toUpperCase()} ({turnsLeft})
    </span>
  );
}
```

---

## 4 · Animations

All animations must use CSS keyframes + Tailwind or plain CSS classes. Apply via `className` toggling in React state.

### 4.1 Attack animation (attacker shakes forward)

```css
@keyframes attack-lunge {
  0%   { transform: translate(0, 0); }
  30%  { transform: translate(20px, -10px) scale(1.05); }
  60%  { transform: translate(-5px, 5px); }
  100% { transform: translate(0, 0); }
}
.anim-attack { animation: attack-lunge 0.4s ease-in-out; }
```

### 4.2 Damage flash (defender flashes white/red)

```css
@keyframes damage-flash {
  0%, 100% { filter: none; }
  25%       { filter: brightness(3) saturate(0); }
  50%       { filter: none; }
  75%       { filter: brightness(3) saturate(0); }
}
.anim-damage { animation: damage-flash 0.5s ease; }
```

### 4.3 Faint animation (fall down and fade)

```css
@keyframes faint {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(60px); opacity: 0; }
}
.anim-faint { animation: faint 0.6s ease-in forwards; }
```

### 4.4 HP bar animated drain

Use CSS `transition: width 0.5s ease` on the fill. Update the width via state after server response.

### 4.5 Sprite entrance (switch-in)

```css
@keyframes slide-in-left {
  from { transform: translateX(-120px); opacity: 0; }
  to   { transform: translateX(0);      opacity: 1; }
}
@keyframes slide-in-right {
  from { transform: translateX(120px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
.anim-enter-player   { animation: slide-in-left  0.35s ease-out; }
.anim-enter-opponent { animation: slide-in-right 0.35s ease-out; }
```

### 4.6 Applying animations in React

```tsx
// Example pattern — attach class, remove after animation ends
const [animClass, setAnimClass] = useState('');

function triggerAnim(cls: string) {
  setAnimClass(cls);
  setTimeout(() => setAnimClass(''), 600);
}

// When server says attacker moved:
triggerAnim('anim-attack');
// When server says this pokemon took damage:
triggerAnim('anim-damage');
```

---

## 5 · Battle log

```css
.battle-log {
  background: rgba(0,0,0,0.7);
  border: 2px solid var(--bw-white);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  font-family: var(--font-pixel);
  font-size: var(--font-size-xs);
  color: var(--bw-text-light);
  overflow-y: auto;
  max-height: 140px;
  line-height: 1.8;
  scroll-behavior: smooth;
}
.battle-log p { margin: 0; }
.battle-log .log-effective   { color: #f8d030; }
.battle-log .log-supereff    { color: #f03028; font-weight: bold; }
.battle-log .log-noeffect    { color: #888; }
.battle-log .log-faint       { color: var(--bw-hp-red); }
.battle-log .log-status      { color: #a040a0; }
```

Auto-scroll to bottom after each update:

```tsx
const logRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
}, [battleLog]);
```

---

## 6 · Team selection screen

- Show a scrollable grid of Pokémon cards (max 300).
- Each card: animated front sprite (72×72 px), name in `var(--font-pixel)`, type badges.
- Selected cards get a golden border `3px solid #f8d030`.
- Counter showing `X / 6` selected.
- Confirm button disabled until exactly 6 chosen (or fewer if fewer available).

```css
.pokemon-card {
  background: var(--bw-panel);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  padding: 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
  image-rendering: pixelated;
}
.pokemon-card.selected {
  border-color: #f8d030;
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(248,208,48,0.6);
}
```

---

## 7 · Lobby / waiting screen

- Display room code in huge `var(--font-pixel)` text with a copy button.
- Animated Poké Ball spinner while waiting for opponent.
- Show player names as they join.

```css
@keyframes pokeball-spin {
  to { transform: rotate(360deg); }
}
.pokeball-spinner {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 4px solid var(--bw-white);
  border-top-color: var(--bw-hp-red);
  animation: pokeball-spin 0.8s linear infinite;
}
```

---

## 8 · Checklist before shipping any screen

- [ ] Only Gen-5 animated GIF sprites (Showdown `ani/` folder) — no 3-D models
- [ ] `image-rendering: pixelated` on all sprites
- [ ] All text using `--font-pixel` or `--font-ui` (no system fonts)
- [ ] Colours only from the design token set
- [ ] HP bar changes colour at ≤50 % (yellow) and ≤25 % (red)
- [ ] Status badge visible with turns remaining
- [ ] Battle log auto-scrolls and uses colour-coded lines
- [ ] Attack, damage, faint, and switch-in animations wired to server events
- [ ] Move buttons coloured by move type
- [ ] No mixing of visual styles from different Pokémon generations

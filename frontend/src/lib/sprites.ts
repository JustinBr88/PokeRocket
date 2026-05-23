const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export { API_URL, WS_URL };

export function toShowdownName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-')
    .replace(/\./g, '');
}

export function getFrontSprite(name: string): string {
  return `https://play.pokemonshowdown.com/sprites/ani/${toShowdownName(name)}.gif`;
}

export function getBackSprite(name: string): string {
  return `https://play.pokemonshowdown.com/sprites/ani-back/${toShowdownName(name)}.gif`;
}

export function getIconSprite(name: string): string {
  return `https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png`;
}

export function hpColor(pct: number): string {
  if (pct > 0.5) return 'hp-green';
  if (pct > 0.25) return 'hp-yellow';
  return 'hp-red';
}
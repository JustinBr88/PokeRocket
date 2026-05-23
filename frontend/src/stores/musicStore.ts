/**
 * Zustand store para estado de música
 */

import { create } from 'zustand';

interface PremiumInfo {
  player1HasPremium: boolean;
  player2HasPremium: boolean;
}

interface MusicState {
  // Estado de música
  currentMusic: string | null;
  isPlaying: boolean;
  volume: number;

  // Contexto de batalla
  battleMode: 'casual' | 'ranked' | null;
  battleResult: 'victory' | 'defeat' | null;

  // Información de Premium
  premiumInfo?: PremiumInfo;

  // Acciones
  setCurrentMusic: (path: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setBattleContext: (mode: 'casual' | 'ranked', result: 'victory' | 'defeat' | null) => void;
  setPremiumInfo: (info: PremiumInfo) => void;
  clearBattleContext: () => void;
}

export const useMusicStore = create<MusicState>((set) => ({
  // Estado inicial
  currentMusic: null,
  isPlaying: false,
  volume: 0.3,
  battleMode: null,
  battleResult: null,
  premiumInfo: undefined,

  // Acciones
  setCurrentMusic: (path: string | null) =>
    set({ currentMusic: path }),

  setIsPlaying: (playing: boolean) =>
    set({ isPlaying: playing }),

  setVolume: (volume: number) =>
    set({ volume: Math.max(0, Math.min(1, volume)) }),

  setBattleContext: (mode: 'casual' | 'ranked', result: 'victory' | 'defeat' | null) =>
    set({ battleMode: mode, battleResult: result }),

  setPremiumInfo: (info: PremiumInfo) =>
    set({ premiumInfo: info }),

  clearBattleContext: () =>
    set({ battleMode: null, battleResult: null, premiumInfo: undefined }),
}));

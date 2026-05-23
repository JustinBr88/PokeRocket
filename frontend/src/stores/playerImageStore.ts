import { create } from 'zustand';

interface PlayerImageStore {
  playerImages: Record<string, string>; // playerId -> imageUrl
  setPlayerImage: (playerId: string, imageUrl: string) => void;
  getPlayerImage: (playerId: string) => string | undefined;
}

export const usePlayerImageStore = create<PlayerImageStore>((set, get) => ({
  playerImages: {},
  setPlayerImage: (playerId, imageUrl) =>
    set(state => ({
      playerImages: { ...state.playerImages, [playerId]: imageUrl }
    })),
  getPlayerImage: (playerId) => get().playerImages[playerId],
}));

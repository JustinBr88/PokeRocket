import { create } from 'zustand';

interface TeamState {
  currentTeam: {
    pokemonId: number;
    pokemonName: string;
    shiny: boolean;
    shinyEnabled: boolean;
  }[];
  addPokemon: (pokemonId: number, pokemonName: string) => void;
  removePokemon: (index: number) => void;
  toggleShiny: (pokemonId: number) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  currentTeam: [],
  addPokemon: (pokemonId, pokemonName) =>
    set((s) => s.currentTeam.length < 6
      ? { currentTeam: [...s.currentTeam, { pokemonId, pokemonName, shiny: false, shinyEnabled: false }] }
      : s),
  removePokemon: (index) =>
    set((s) => ({ currentTeam: s.currentTeam.filter((_, i) => i !== index) })),
  toggleShiny: (pokemonId) =>
    set((s) => ({
      currentTeam: s.currentTeam.map((p) =>
        p.pokemonId === pokemonId ? { ...p, shinyEnabled: !p.shinyEnabled } : p
      ),
    })),
  clearTeam: () => set({ currentTeam: [] }),
}))
import { create } from 'zustand';

interface TeamMember {
  pokemonId: number;
  pokemonName: string;
  shiny: boolean;
  shinyEnabled: boolean;
  isLegendary?: boolean; // Track if this pokemon is legendary
}

interface TeamState {
  currentTeam: TeamMember[];
  legendaryCount: number; // Track how many legendaries are in the team
  addPokemon: (pokemonId: number, pokemonName: string, isLegendary?: boolean) => { success: boolean; reason?: string };
  removePokemon: (index: number) => void;
  toggleShiny: (pokemonId: number) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  currentTeam: [],
  legendaryCount: 0,
  addPokemon: (pokemonId, pokemonName, isLegendary = false) => {
    const team = get().currentTeam;

    // Check if team is full
    if (team.length >= 6) {
      return { success: false, reason: 'Team is full (max 6)' };
    }

    // Check for duplicate Pokemon
    if (team.some(p => p.pokemonId === pokemonId)) {
      return { success: false, reason: 'Pokemon already in team' };
    }

    // Check legendary limit (max 1 legendary per team)
    if (isLegendary && get().legendaryCount >= 1) {
      return { success: false, reason: 'Only 1 legendary allowed per team' };
    }

    set((s) => ({
      currentTeam: [...s.currentTeam, { pokemonId, pokemonName, shiny: false, shinyEnabled: false, isLegendary }],
      legendaryCount: isLegendary ? s.legendaryCount + 1 : s.legendaryCount,
    }));
    return { success: true };
  },
removePokemon: (index) =>
    set((s) => {
      const removed = s.currentTeam[index];
      return {
        currentTeam: s.currentTeam.filter((_, i) => i !== index),
        legendaryCount: removed?.isLegendary ? s.legendaryCount - 1 : s.legendaryCount,
      };
    }),
  toggleShiny: (pokemonId) =>
    set((s) => ({
      currentTeam: s.currentTeam.map((p) =>
        p.pokemonId === pokemonId ? { ...p, shinyEnabled: !p.shinyEnabled } : p
      ),
    })),
  clearTeam: () => set({ currentTeam: [], legendaryCount: 0 }),
}));
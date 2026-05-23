// Lista de Pokémon legendarios permitidos en el juego (13 total)
// Estos son los únicos legendarios disponibles en el sistema
export const LEGENDARY_IDS = [
  144, // Articuno
  145, // Zapdos
  146, // Moltres
  151, // Mew
  150, // Mewtwo
  243, // Raikou
  244, // Entei
  245, // Suicune
  249, // Lugia
  250, // Ho-Oh
  251, // Celebi
  149, // Dragonite
  248, // Tyranitar
];

export function isLegendaryPokemon(pokedexId: number): boolean {
  return LEGENDARY_IDS.includes(pokedexId);
}
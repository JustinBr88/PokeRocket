import { connectDB } from '../db';
import { PokemonModel, MoveModel } from '../models';
import { MovesetModel } from '../models/Moveset';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '../../..');

const FIELD_MOVE_NAMES = new Set([
  'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Reflect', 'Light Screen',
  'Tailwind', 'Trick Room', 'Gravity', 'Wonder Room', 'Magic Room',
  'Sunny Day', 'Rain Dance', 'Sandstorm', 'Hail', 'Snowscape',
  'Aurora Veil', 'Defog', 'Rapid Spin', 'Court Change',
  'Grassy Terrain', 'Electric Terrain', 'Psychic Terrain', 'Misty Terrain',
]);

// Mapeo de roles del archivo roles_pokemon.txt
const ROLE_MAP: Record<string, string> = {
  '1. Atacante Físico': 'Fisico',
  '2. Atacante Especial': 'Especial',
  '3. Tanque / Defensivo': 'Tanque',
  '4. Veloz / Asesino': 'Asesino',
  '5. Soporte / Utilidad': 'Soporte',
  '6. Equilibrado / Brawler': 'Mixto',
};

interface MoveDoc {
  _id: any;
  pokeApiId: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damageClass: string;
  meta: {
    category?: string;
    healing?: number;
    drain?: number;
    ailment?: string;
    statChanges?: Array<{ stat: string; change: number }>;
    target?: { name?: string };
  };
}

interface PokemonDoc {
  _id: any;
  pokedexId: number;
  name: string;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  moveIds: any[];
}

/**
 * Lee roles_pokemon.txt y devuelve un Map de pokedexId -> role
 */
function loadRolesFromFile(): Map<number, string> {
  const rolesMap = new Map<number, string>();
  const filePath = join(PROJECT_ROOT, 'roles_pokemon.txt');
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let currentRole = '';
  let inRoleSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detectar inicio de sección de rol
    if (trimmed.startsWith('1. Atacante Físico')) {
      currentRole = 'Fisico';
      inRoleSection = true;
      continue;
    } else if (trimmed.startsWith('2. Atacante Especial')) {
      currentRole = 'Especial';
      inRoleSection = true;
      continue;
    } else if (trimmed.startsWith('3. Tanque')) {
      currentRole = 'Tanque';
      inRoleSection = true;
      continue;
    } else if (trimmed.startsWith('4. Veloz')) {
      currentRole = 'Asesino';
      inRoleSection = true;
      continue;
    } else if (trimmed.startsWith('5. Soporte')) {
      currentRole = 'Soporte';
      inRoleSection = true;
      continue;
    } else if (trimmed.startsWith('6. Equilibrado')) {
      currentRole = 'Mixto';
      inRoleSection = true;
      continue;
    }

    // Fin de secciones (después de #299 Nosepass)
    if (trimmed.includes('Duplicado resuelto') || trimmed.includes('Ajustado')) {
      inRoleSection = false;
      continue;
    }

    // Parsear Pokémon (#XXX Name)
    if (inRoleSection && trimmed.startsWith('#')) {
      // Extraer número de Pokédex
      const match = trimmed.match(/#(\d+)/);
      if (match && currentRole) {
        const pokedexId = parseInt(match[1]);
        rolesMap.set(pokedexId, currentRole);
      }
    }
  }

  console.log(`📋 Roles cargados desde archivo: ${rolesMap.size} Pokémon`);
  return rolesMap;
}

function isFieldMove(move: MoveDoc): boolean {
  if (FIELD_MOVE_NAMES.has(move.name)) return true;
  if (move.meta?.category === 'field-effect') return true;
  if (move.meta?.target?.name?.includes('field')) return true;
  return false;
}

function getMoveCategory(move: MoveDoc): string {
  if (move.meta?.healing && move.meta.healing > 0) return 'healing';
  if (move.meta?.drain && move.meta.drain > 0) return 'healing';
  if (move.meta?.statChanges?.some((s: { stat: string; change: number }) => s.change > 0)) return 'setup';
  // Ailment SOLO si es status move (daño primario es causar estado, no daño colateral)
  if (move.meta?.ailment && move.meta?.ailment !== 'none' && move.damageClass === 'status') return 'ailment';
  if (move.meta?.statChanges?.some((s: { stat: string; change: number }) => s.change < 0)) return 'debuff';
  if (move.power !== null && move.damageClass !== 'status') return 'damage';
  return 'damage';
}

function detectRole(pokemon: PokemonDoc, healingCount: number, setupCount: number, ailmentStatusCount: number, physicalCount: number, specialCount: number): string {
  if (healingCount > 0) return 'Soporte';
  if (setupCount >= 2) return 'Mixto';
  // Solo cuenta ailment si el move es status (daño primario es causar estado)
  if (ailmentStatusCount >= 2) return 'Asesino';
  if (pokemon.baseStats.hp > 90 && pokemon.baseStats.defense > 85) return 'Tanque';
  if (physicalCount >= 2) return 'Fisico';
  if (specialCount >= 2) return 'Especial';
  return 'Mixto';
}

function getSoundPath(moveName: string): string | null {
  const fileName = `${moveName}.mp3`;
  const fullPath = join(PROJECT_ROOT, 'sonidos', 'Attack Moves', fileName);
  if (existsSync(fullPath)) {
    return `sonidos/Attack Moves/${fileName}`;
  }
  return null;
}

async function generateMovesets() {
  console.log('🔄 Conectando a MongoDB...');
  await connectDB();

  // Cargar roles desde archivo roles_pokemon.txt
  console.log('📋 Cargando roles desde roles_pokemon.txt...');
  const rolesFromFile = loadRolesFromFile();

  console.log('📦 Obteniendo todos los Pokémon...');
  const pokemons = await PokemonModel.find() as PokemonDoc[];
  console.log(`   Encontrados ${pokemons.length} Pokémon`);

  const moves = await MoveModel.find() as MoveDoc[];
  console.log(`   Encontrados ${moves.length} moves`);

  const moveMap = new Map<number, MoveDoc>();
  for (const move of moves) {
    moveMap.set(move.pokeApiId, move);
  }

  let processed = 0;
  let errors = 0;
  let rolesFromFileCount = 0;
  let rolesAutoCount = 0;

  for (const pokemon of pokemons) {
    try {
      const pokemonMoves: MoveDoc[] = [];
      for (const moveId of pokemon.moveIds) {
        const move = moves.find(m => m._id.toString() === moveId.toString());
        if (move) {
          pokemonMoves.push(move);
        }
      }

      const filteredMoves = pokemonMoves.filter(m => !isFieldMove(m));

      const categorized = {
        healing: [] as MoveDoc[],
        setup: [] as MoveDoc[],
        ailment: [] as MoveDoc[],
        debuff: [] as MoveDoc[],
        damage: [] as MoveDoc[],
      };

      for (const move of filteredMoves) {
        const category = getMoveCategory(move);
        if (categorized[category as keyof typeof categorized]) {
          categorized[category as keyof typeof categorized].push(move);
        }
      }

      const selectedMoves: MoveDoc[] = [];
      const addMoves = (arr: MoveDoc[], count: number) => {
        for (let i = 0; i < Math.min(count, arr.length) && selectedMoves.length < 12; i++) {
          if (!selectedMoves.includes(arr[i])) {
            selectedMoves.push(arr[i]);
          }
        }
      };

      addMoves(categorized.healing, 2);
      addMoves(categorized.setup, 2);
      addMoves(categorized.ailment, 2);
      addMoves(categorized.debuff, 2);

      const damagingSorted = [...categorized.damage].sort((a, b) => {
        const scoreA = (a.accuracy || 100) * (a.power || 0);
        const scoreB = (b.accuracy || 100) * (b.power || 0);
        return scoreB - scoreA;
      });
      addMoves(damagingSorted, 4);

      if (selectedMoves.length < 12 && filteredMoves.length > selectedMoves.length) {
        const remaining = filteredMoves.filter(m => !selectedMoves.includes(m));
        addMoves(remaining, 12 - selectedMoves.length);
      }

      let healingCount = categorized.healing.length;
      let setupCount = categorized.setup.length;
      // Solo cuenta ailment si es status move (daño primario causar estado, no daño colateral)
      let ailmentStatusCount = categorized.ailment.filter(m => m.damageClass === 'status').length;
      // Contar sobre TODOS los moves filtrados (~20), no solo los 12 seleccionados
      let physicalCount = filteredMoves.filter(m => m.damageClass === 'physical' && (m.power || 0) > 70).length;
      let specialCount = filteredMoves.filter(m => m.damageClass === 'special' && (m.power || 0) > 70).length;

      // Usar rol del archivo roles_pokemon.txt si existe, sino calcular automáticamente
      let role: string;
      const roleFromFile = rolesFromFile.get(pokemon.pokedexId);
      if (roleFromFile) {
        role = roleFromFile;
        rolesFromFileCount++;
      } else {
        role = detectRole(pokemon, healingCount, setupCount, ailmentStatusCount, physicalCount, specialCount);
        rolesAutoCount++;
      }

      // Select 4 "famous" moves based on different categories
      const famousMoves: MoveDoc[] = [];

      // 1. Best damage move (highest power * accuracy)
      const damagesByScore = [...categorized.damage].sort((a, b) => {
        const scoreA = (a.accuracy || 100) * (a.power || 0);
        const scoreB = (b.accuracy || 100) * (b.power || 0);
        return scoreB - scoreA;
      });
      if (damagesByScore.length > 0 && selectedMoves.includes(damagesByScore[0])) {
        famousMoves.push(damagesByScore[0]);
      }

      // 2. Best setup move (if available)
      if (categorized.setup.length > 0 && selectedMoves.includes(categorized.setup[0])) {
        famousMoves.push(categorized.setup[0]);
      }

      // 3. Best healing move (if available)
      if (categorized.healing.length > 0 && selectedMoves.includes(categorized.healing[0])) {
        famousMoves.push(categorized.healing[0]);
      }

      // 4. Best ailment move (ONLY status moves, not damage moves with side-effect ailment)
      const ailmentStatusMoves = categorized.ailment.filter(m => m.damageClass === 'status');
      if (ailmentStatusMoves.length > 0 && selectedMoves.includes(ailmentStatusMoves[0])) {
        famousMoves.push(ailmentStatusMoves[0]);
      }

      // If we don't have 4 famous yet, fill with extra damage moves
      while (famousMoves.length < 4 && damagesByScore.length > famousMoves.length) {
        const nextDamage = damagesByScore[famousMoves.length];
        if (selectedMoves.includes(nextDamage) && !famousMoves.includes(nextDamage)) {
          famousMoves.push(nextDamage);
        }
      }

      const movesetMoves = selectedMoves.map(m => ({
        moveId: m.pokeApiId,
        moveName: m.name,
        type: m.type,
        power: m.power ?? null,
        accuracy: m.accuracy ?? null,
        damageClass: m.damageClass,
        priority: m.priority,
        category: getMoveCategory(m),
        soundPath: getSoundPath(m.name),
        famous: famousMoves.includes(m),
      }));

      await MovesetModel.findOneAndUpdate(
        { pokemonId: pokemon.pokedexId },
        {
          pokemonId: pokemon.pokedexId,
          pokemonName: pokemon.name,
          role,
          moves: movesetMoves,
        },
        { upsert: true, new: true }
      );

      await PokemonModel.findByIdAndUpdate(pokemon._id, { role });

      processed++;
      if (processed % 50 === 0) {
        console.log(`   Procesados ${processed}/${pokemons.length}...`);
      }
    } catch (err) {
      errors++;
      console.error(`   Error con ${pokemon.name} (${pokemon.pokedexId}):`, err);
    }
  }

  console.log('\n✅ Generación completa!');
  console.log(`   Movesets creados: ${processed}`);
  console.log(`   Errores: ${errors}`);
  console.log(`   Roles desde archivo: ${rolesFromFileCount}`);
  console.log(`   Roles auto-calculados: ${rolesAutoCount}`);

  const totalMovesets = await MovesetModel.countDocuments();
  console.log(`   Total en DB: ${totalMovesets}`);
}

generateMovesets().catch(console.error);
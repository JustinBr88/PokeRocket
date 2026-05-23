import { connectDB } from '../db';
import { PokemonModel, MoveModel, TypeRelationModel } from '../models/index';
import { detectRole, MoveDocument } from '../services/roleDetection';

const POKEMON_LIMIT = 300;
const MOVE_CACHE = new Map<number, string>();
const DELAY_MS = 50;

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Import a single move with full meta data
async function importMove(pokeApiMoveId: number): Promise<string | null> {
  if (MOVE_CACHE.has(pokeApiMoveId)) {
    return MOVE_CACHE.get(pokeApiMoveId)!;
  }

  try {
    // Check if already exists
    const existing = await MoveModel.findOne({ pokeApiId: pokeApiMoveId });
    if (existing) {
      MOVE_CACHE.set(pokeApiMoveId, String(existing._id));
      return String(existing._id);
    }

    // Fetch full move data from PokeAPI
    await sleep(DELAY_MS); // Rate limit avoidance
    const data = await fetchJSON(`https://pokeapi.co/api/v2/move/${pokeApiMoveId}`);

    // Extract meta fields
    const meta = {
      category: data.meta?.category?.name ?? 'damage',
      healing: data.meta?.healing ?? 0,
      drain: data.meta?.drain ?? 0,
      ailment: data.meta?.ailment?.name ?? 'none',
      statChanges: (data.stat_changes ?? []).map((sc: any) => ({
        stat: sc.stat?.name ?? '',
        change: sc.change ?? 0,
      })),
      target: { name: data.target?.name ?? 'selected-pokemon' },
    };

    const move = await MoveModel.create({
      pokeApiId: data.id,
      name: data.name,
      type: data.type.name,
      power: data.power ?? null,
      accuracy: data.accuracy ?? null,
      priority: data.priority ?? 0,
      damageClass: data.damage_class.name,
      effect:
        data.effect_entries?.find((e: any) => e.language.name === 'en')?.short_effect ??
        data.effect_entries?.[0]?.short_effect ??
        '',
      meta,
    });

    MOVE_CACHE.set(pokeApiMoveId, String(move._id));
    return String(move._id);
  } catch (err) {
    console.error(`[move-err] ${pokeApiMoveId}:`, err);
    return null;
  }
}

// Get all versions that learn this move, find earliest game (for popularity proxy)
function getEarliestVersion(moveData: any): number {
  const versionGroups = moveData.version_group_details ?? [];
  if (versionGroups.length === 0) return 999;
  // Lower = earlier generation = more iconic
  // version_group URLs look like: .../version-group/1/ (gen 1)
  const minOrder = Math.min(
    ...versionGroups.map((vg: any) => {
      const url = vg.version_group?.url ?? '';
      const match = url.match(/version-group\/(\d+)/);
      return match ? parseInt(match[1]) : 999;
    })
  );
  return minOrder;
}

async function importTypes() {
  const typeList = await fetchJSON('https://pokeapi.co/api/v2/type?limit=20');
  for (const t of typeList.results) {
    const data = await fetchJSON(t.url);
    const rel = data.damage_relations;
    await TypeRelationModel.findOneAndUpdate(
      { attackingType: data.name },
      {
        attackingType: data.name,
        doubleDamageTo: rel.double_damage_to.map((x: any) => x.name),
        halfDamageTo: rel.half_damage_to.map((x: any) => x.name),
        noDamageTo: rel.no_damage_to.map((x: any) => x.name),
      },
      { upsert: true }
    );
    console.log(`[types] imported ${data.name}`);
  }
}

async function main() {
  console.log('[import] Starting Phase 3 import with meta fields + role detection...');
  await connectDB();
  await importTypes();

  // Fetch Pokemon list
  const list = await fetchJSON(
    `https://pokeapi.co/api/v2/pokemon?limit=${POKEMON_LIMIT}&offset=0`
  );

  let imported = 0;
  let skipped = 0;

  for (const entry of list.results) {
    try {
      const data = await fetchJSON(entry.url);

      // Get ALL move URLs (not just 20, fetch up to 20 for better selection)
      const allMoveUrls = data.moves
        .map((m: any) => ({
          url: m.move.url,
          id: parseInt(m.move.url.split('/').filter(Boolean).pop() ?? '0'),
        }))
        .slice(0, 20);

      // Import all moves
      const moveIds: string[] = [];
      const moveDocuments: MoveDocument[] = [];

      for (const { url, id } of allMoveUrls) {
        if (moveIds.length >= 20) break;
        const mongoId = await importMove(id);
        if (mongoId) {
          moveIds.push(mongoId);
          // Fetch the full document to use in role detection
          const doc = await MoveModel.findById(mongoId).lean();
          if (doc) {
            moveDocuments.push(doc as unknown as MoveDocument);
          }
        }
      }

      if (moveDocuments.length < 4) {
        console.warn(`[skip] ${data.name} — only ${moveDocuments.length} valid moves`);
        skipped++;
        continue;
      }

      // Detect role based on all moves
      const statsMap: Record<string, number> = {};
      for (const s of data.stats) {
        statsMap[s.stat.name] = s.base_stat;
      }

      const baseStats = {
        hp: statsMap['hp'] ?? 0,
        attack: statsMap['attack'] ?? 0,
        defense: statsMap['defense'] ?? 0,
        specialAttack: statsMap['special-attack'] ?? 0,
        specialDefense: statsMap['special-defense'] ?? 0,
        speed: statsMap['speed'] ?? 0,
      };

      const role = detectRole(moveDocuments, baseStats);

      // Gen 5 animated sprite from PokeAPI (fallback only)
      const spriteUrl =
        data.sprites.versions?.['generation-v']?.['black-white']?.animated
          ?.front_default ?? data.sprites.front_default;

      await PokemonModel.findOneAndUpdate(
        { pokedexId: data.id },
        {
          pokedexId: data.id,
          name: data.name,
          types: data.types.map((t: any) => t.type.name),
          baseStats,
          spriteUrl,
          moveIds: moveIds, // Store all imported moveIds (~20)
          isLegendary: data.is_legendary ?? false,
          isMythical: data.is_mythical ?? false,
          generation: 5,
          role,
        },
        { upsert: true }
      );

      console.log(
        `[import] ${data.name} — role: ${role} — moves: ${moveIds.length}`
      );
      imported++;
    } catch (err) {
      console.error(`[error] ${entry.name}:`, err);
    }
  }

  console.log(`\n[dONE] Import complete: ${imported} imported, ${skipped} skipped`);
  process.exit(0);
}

main();
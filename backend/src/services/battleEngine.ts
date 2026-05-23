import { BattleModel, RoomModel, UserModel, BattleHistoryModel } from '../models/index';
import { broadcastToRoom } from '../ws/roomRegistry';

const LEVEL = 50;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateIVs() {
  return {
    hp: randomInt(0, 31), attack: randomInt(0, 31),
    defense: randomInt(0, 31), specialAttack: randomInt(0, 31),
    specialDefense: randomInt(0, 31), speed: randomInt(0, 31),
  };
}

function calcHp(base: number, iv: number) {
  return Math.floor(((2 * base + iv) * LEVEL) / 100) + LEVEL + 10;
}

function calcStat(base: number, iv: number) {
  return Math.floor(((2 * base + iv) * LEVEL) / 100) + 5;
}

function stageMultiplier(stage: number) {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

function effectiveStat(base: number, stage: number) {
  return Math.floor(base * stageMultiplier(stage));
}

// Type effectiveness cache (loaded at startup)
let typeCache: Map<string, { doubleTo: Set<string>; halfTo: Set<string>; noTo: Set<string> }> = new Map();

export async function loadTypeCache(typeRelations: any[]) {
  typeCache = new Map();
  for (const t of typeRelations) {
    typeCache.set(t.attackingType, {
      doubleTo: new Set(t.doubleDamageTo),
      halfTo: new Set(t.halfDamageTo),
      noTo: new Set(t.noDamageTo),
    });
  }
}

function getMultiplier(attackType: string, defenderType: string): number {
  const rel = typeCache.get(attackType);
  if (!rel) return 1;
  if (rel.noTo.has(defenderType)) return 0;
  if (rel.doubleTo.has(defenderType)) return 2;
  if (rel.halfTo.has(defenderType)) return 0.5;
  return 1;
}

function typeEffectiveness(attackType: string, defenderTypes: string[]): number {
  return defenderTypes.reduce((acc, dt) => acc * getMultiplier(attackType, dt), 1);
}

export function calculateDamage(
  attacker: any,
  defender: any,
  move: any,
): { damage: number; effectiveness: number; isCritical: boolean; missed: boolean } {
  const accuracy = move.accuracy ?? 100;
  if (randomInt(1, 100) > accuracy) {
    return { damage: 0, effectiveness: 1, isCritical: false, missed: true };
  }

  if (move.damageClass === 'status' || !move.power) {
    return { damage: 0, effectiveness: 1, isCritical: false, missed: false };
  }

  const isPhysical = move.damageClass === 'physical';
  const atkStage = isPhysical ? attacker.statStages.attack : attacker.statStages.specialAttack;
  const defStage = isPhysical ? defender.statStages.defense : defender.statStages.specialDefense;

  const atkBase = isPhysical ? attacker.battleStats.attack : attacker.battleStats.specialAttack;
  const defBase = isPhysical ? defender.battleStats.defense : defender.battleStats.specialDefense;

  const atk = effectiveStat(atkBase, atkStage);
  const def = effectiveStat(defBase, defStage);

  const base = Math.floor(
    Math.floor(((2 * LEVEL) / 5 + 2) * move.power * atk / def) / 50,
  ) + 2;

  const randomFactor = randomInt(85, 100) / 100;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = typeEffectiveness(move.type, defender.types);
  const isCritical = Math.random() < 1 / 24;
  const critical = isCritical ? 1.5 : 1;
  const burnModifier = (attacker.status === 'burn' && isPhysical) ? 0.5 : 1;

  if (effectiveness === 0) return { damage: 0, effectiveness: 0, isCritical: false, missed: false };

  const modifier = randomFactor * stab * effectiveness * critical * burnModifier;
  const damage = Math.max(1, Math.floor(base * modifier));

  return { damage, effectiveness, isCritical, missed: false };
}

function applyPassiveStatus(pokemon: any, log: string[]) {
  if (!pokemon.status || pokemon.statusTurns <= 0 || pokemon.currentHp <= 0) return;

  let dmg: number;
  if (pokemon.status === 'burn' || pokemon.status === 'poison') {
    dmg = Math.floor(pokemon.maxHp * 0.0625);
    log.push(`${pokemon.name} is hurt by ${pokemon.status}! (-${dmg} HP)`);
  } else if (pokemon.status === 'toxic') {
    // Toxic: damage increases each turn (1/16, 2/16, ..., 7/16 max)
    // statusTurns starts at 7, decrements each turn
    // When statusTurns=7: 1/16, statusTurns=6: 2/16, ..., statusTurns=1: 7/16
    const toxicDamage = 8 - pokemon.statusTurns;
    dmg = Math.floor(pokemon.maxHp * toxicDamage / 16);
    log.push(`${pokemon.name} is badly poisoned! (-${dmg} HP)`);
  } else {
    return;
  }

  pokemon.currentHp = Math.max(0, (pokemon.currentHp ?? 0) - dmg);

  pokemon.statusTurns -= 1;
  if (pokemon.statusTurns <= 0) {
    if (pokemon.status === 'toxic') {
      log.push(`${pokemon.name}'s toxic wore off.`);
    } else if (pokemon.status) {
      log.push(`${pokemon.name}'s ${pokemon.status} wore off.`);
    }
    pokemon.status = null;
    pokemon.statusTurns = 0;
  }
}

function clearStatus(pokemon: any) {
  pokemon.status = null;
  pokemon.statusTurns = 0;
  pokemon.statStages = { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
}

export async function resolveTurn(roomCode: string) {
  try {
    const battle = await BattleModel.findOne({ roomCode });
    if (!battle || battle.status !== 'active') return;

    const [p1, p2] = battle.players;

    console.log(`[BattleEngine] Resolving turn for ${roomCode}, turn: ${battle.turn}`);
    console.log(`[BattleEngine] P1 action:`, p1.selectedAction, 'P2 action:', p2.selectedAction);

    if (!p1.selectedAction || !p2.selectedAction) {
      console.log(`[BattleEngine] Not both players ready, returning early`);
      return;
    }

    const log: string[] = [];

    function effectiveSpeed(player: any) {
      const active = player.team[player.activePokemonIdx];
      let spd = effectiveStat(active.battleStats.speed, active.statStages.speed);
      if (active.status === 'paralyze') spd = Math.floor(spd / 2);
      return spd;
    }

    // Determine order: priority first, then speed, then coin flip
    let order: [typeof p1, typeof p2] | [typeof p2, typeof p1];
    const getMovePriority = (action: any, team: any[], activePokemonIdx: number): number => {
      if (action.type === 'switch') return 6; // Alta prioridad - va primero
      if (action.type === 'heal') return 5;   // Pierde turno, menor prioridad
      const active = team[activePokemonIdx];
      const moves = active.moves as any[];
      const move = moves.find((m: any) => String(m.moveId) === action.moveId);
      return (move as any)?.priority ?? 0;
    };
    const p1Pri = getMovePriority(p1.selectedAction, p1.team, p1.activePokemonIdx);
    const p2Pri = getMovePriority(p2.selectedAction, p2.team, p2.activePokemonIdx);

    if (p1Pri !== p2Pri) {
      order = p1Pri > p2Pri ? [p1, p2] : [p2, p1];
    } else {
      const p1Spd = effectiveSpeed(p1);
      const p2Spd = effectiveSpeed(p2);
      if (p1Spd !== p2Spd) {
        order = p1Spd > p2Spd ? [p1, p2] : [p2, p1];
      } else {
        order = Math.random() < 0.5 ? [p1, p2] : [p2, p1];
      }
    }

    for (const actor of order) {
      const other = actor === p1 ? p2 : p1;
      const action = actor.selectedAction;
      const active = actor.team[actor.activePokemonIdx];
      const target = other.team[other.activePokemonIdx];

      if (active.currentHp == null || active.currentHp <= 0) continue;

      // CHECK STATUS EFFECTS BEFORE PROCESSING ACTION
      if (active.status === 'sleep') {
        if (Math.random() < 0.33) { // 1/3 chance to wake up
          log.push(`${active.name} woke up!`);
          active.status = null;
          active.statusTurns = 0;
        } else {
          log.push(`${active.name} is asleep...`);
          actor.selectedAction = null;
          actor.team[actor.activePokemonIdx].statusTurns -= 1;
          continue; // Skip this actor's turn
        }
      }

      if (active.status === 'freeze') {
        if (Math.random() < 0.20) { // 20% chance to thaw
          log.push(`${active.name} thawed out!`);
          active.status = null;
          active.statusTurns = 0;
        } else {
          log.push(`${active.name} is frozen solid!`);
          actor.selectedAction = null;
          actor.team[actor.activePokemonIdx].statusTurns -= 1;
          continue;
        }
      }

      if (active.status === 'paralysis') {
        if (Math.random() < 0.25) { // 25% chance to be fully paralyzed
          log.push(`${active.name} is fully paralyzed! It can't move!`);
          actor.selectedAction = null;
          continue;
        }
      }

      if (action.type === 'switch') {
        const newIdx = actor.team.findIndex(
          (p: any, i: number) => i !== actor.activePokemonIdx && p.currentHp > 0 && Number(p.pokemonId) === Number(action.pokemonId),
        );
        if (newIdx !== -1) {
          clearStatus(active);
          actor.activePokemonIdx = newIdx;
          log.push(`${actor.name} switched to ${actor.team[newIdx].name}!`);
        }
      } else if (action.type === 'heal') {
        // Heal restores 30% of max HP but skips attacking
        const healAmount = Math.floor(active.maxHp * 0.3);
        active.currentHp = Math.min(active.maxHp, (active.currentHp ?? 0) + healAmount);
        log.push(`${active.name} restored ${healAmount} HP!`);
      } else if (action.type === 'move') {
        const move = active.moves.find((m: any) => String(m.moveId) === action.moveId) as any;
        if (!move) continue;

        log.push(`${active.name} used ${move.name}!`);

        const { damage, effectiveness, isCritical, missed } = calculateDamage(active, target, move);

        if (missed) {
          log.push(`${active.name}'s attack missed!`);
        } else if (effectiveness === 0) {
          log.push(`It had no effect on ${target.name}...`);
        } else {
          if (isCritical) log.push('A critical hit!');
          if (effectiveness > 1) log.push("It's super effective!");
          if (effectiveness < 1) log.push("It's not very effective...");

          target.currentHp = Math.max(0, (target.currentHp ?? 0) - damage);
          log.push(`${target.name} took ${damage} damage. (${target.currentHp}/${target.maxHp} HP)`);

          if (target.currentHp === 0) {
            log.push(`${target.name} fainted!`);
            const nextAlive = other.team.findIndex((p: any, i: number) => i !== other.activePokemonIdx && p.currentHp > 0);
            if (nextAlive !== -1) other.activePokemonIdx = nextAlive;
          }

          // Apply status from move (after damage calculation)
          if (move.meta?.ailment && move.meta.ailment !== 'none' && !target.status) {
            target.status = move.meta.ailment;
            target.statusTurns = move.meta.ailment === 'sleep' ? Math.floor(Math.random() * 3) + 1 :
                                move.meta.ailment === 'toxic' ? 7 : 3;
            log.push(`${target.name} is now ${target.status}!`);
          }
        }

        // Check if attacker also fainted (from recoil, self-destruct, etc.)
        if (active.currentHp <= 0) {
          log.push(`${active.name} fainted!`);
          const nextAliveActor = actor.team.findIndex((p: any, i: number) => i !== actor.activePokemonIdx && p.currentHp > 0);
          if (nextAliveActor !== -1) actor.activePokemonIdx = nextAliveActor;
        }
      }
    }

    // Passive status damage (end of turn)
    for (const player of [p1, p2]) {
      const active = player.team[player.activePokemonIdx];
      if (active.currentHp == null || active.currentHp > 0) applyPassiveStatus(active, log);
    }

    // Victory check
    function allFainted(player: any) {
      return player.team.every((p: any) => p.currentHp <= 0);
    }

    function effectiveSpeed(player: any) {
      const active = player.team[player.activePokemonIdx];
      let spd = effectiveStat(active.battleStats.speed, active.statStages.speed);
      if (active.status === 'paralyze') spd = Math.floor(spd / 2);
      return spd;
    }

    let winner: string | null = null;
    if (allFainted(p1) && allFainted(p2)) {
      // DOUBLE KO - decide by speed, if same speed then random
      const p1Spd = effectiveSpeed(p1);
      const p2Spd = effectiveSpeed(p2);
      if (p1Spd !== p2Spd) {
        winner = p1Spd > p2Spd ? p1.odiserId ?? null : p2.odiserId ?? null;
        log.push(`DOUBLE KO! ${winner === p1.odiserId ? p1.name : p2.name} wins by speed!`);
      } else {
        winner = Math.random() < 0.5 ? (p1.odiserId ?? null) : (p2.odiserId ?? null);
        log.push(`DOUBLE KO! ${winner === p1.odiserId ? p1.name : p2.name} wins by random!`);
      }
    } else if (allFainted(p1)) {
      winner = p2.odiserId ?? null;
      log.push(`${p2.name} wins!`);
    } else if (allFainted(p2)) {
      winner = p1.odiserId ?? null;
      log.push(`${p1.name} wins!`);
    }

    // Clear actions, increment turn
    p1.selectedAction = null;
    p2.selectedAction = null;
    battle.turn += 1;
    battle.battleLog.push(...log);
    if (winner) {
      battle.status = 'finished';
      battle.winnerUserId = winner ?? null;

      // Update ELO for ranked battles
      const room = await RoomModel.findOne({ code: roomCode });
      if (room?.mode === 'ranked') {
        const K = 32;
        const players = battle.players;
        const winnerPlayer = players.find((p: any) => p.odiserId === winner);
        const loserPlayer = players.find((p: any) => p.odiserId !== winner);

        if (winnerPlayer && loserPlayer) {
          const winnerUser = await UserModel.findOne({ odiserId: winnerPlayer.odiserId });
          const loserUser = await UserModel.findOne({ odiserId: loserPlayer.odiserId });

          if (winnerUser && loserUser) {
            const expectedWinner = 1 / (1 + Math.pow(10, (loserUser.elo - winnerUser.elo) / 400));
            const expectedLoser = 1 / (1 + Math.pow(10, (winnerUser.elo - loserUser.elo) / 400));

            winnerUser.elo = Math.round(winnerUser.elo + K * (1 - expectedWinner));
            loserUser.elo = Math.round(loserUser.elo + K * (0 - expectedLoser));
            winnerUser.wins += 1;
            loserUser.losses += 1;

            await winnerUser.save();
            await loserUser.save();
          }
        }
      }

      // Save BattleHistory — wrapped so failures don't block battle resolution
      try {
        await BattleHistoryModel.create({
          roomCode,
          players: battle.players.map((p: any) => ({
            odiserId: p.odiserId,
            name: p.name,
            team: p.team.map((bp: any) => ({
              pokemonId: bp.pokemonId,
              name: bp.name,
              pokemonRemaining: bp.currentHp > 0 ? 1 : 0,
            })),
            totalDamageDealt: 0,
          })),
          winnerUserId: winner,
          turnCount: battle.turn,
          mode: room?.mode ?? 'casual',
        });
      } catch (histErr) {
        console.error('[BattleEngine] BattleHistory save failed (battle still resolved):', histErr);
      }
    }

    battle.updatedAt = new Date();
    await battle.save();

    broadcastToRoom(roomCode, { type: 'TURN_RESOLVED', battle: battle.toObject() });
    if (winner) broadcastToRoom(roomCode, { type: 'BATTLE_ENDED', winnerUserId: winner });
  } catch (err) {
    console.error('[BattleEngine] resolveTurn error:', err);
  }
}

// Select battle music: premium random or normal based on mode
export function selectBattleMusic(
  battleMode: 'casual' | 'ranked',
  hasAnyPremium: boolean,
): string {
  if (hasAnyPremium) {
    const premiumTracks = [
      'sonidos/Music/Batalla_Premium1.mp3',
      'sonidos/Music/Batalla_Premium2.mp3',
      'sonidos/Music/Batalla_Premium3.mp3',
    ];
    const randomIndex = Math.floor(Math.random() * premiumTracks.length);
    console.log(`[BATTLE] Selected premium track: ${premiumTracks[randomIndex]}`);
    return premiumTracks[randomIndex];
  }

  const normalTrack = battleMode === 'ranked'
    ? 'sonidos/Music/Batalla_Ranked.mp3'
    : 'sonidos/Music/Batalla_Casual.mp3';

  console.log(`[BATTLE] Selected normal track: ${normalTrack}`);
  return normalTrack;
}

// Build a BattlePokemon from a selected Pokemon + moves (4 famous moves)
export async function buildBattlePokemon(
  pokemonDoc: any,
  selectedMoves: any[],
  side: 'blue' | 'red',
) {
  const ivs = generateIVs();
  const maxHp = calcHp(pokemonDoc.baseStats.hp, ivs.hp);

  // Build moves array — moveId is stored as pokeApiId (number)
  const movesData = selectedMoves.map((m: any) => ({
    moveId: m.pokeApiId ?? m.moveId ?? m._id,
    name: m.name || m.moveName,
    type: m.type || 'normal',
    power: m.power ?? null,
    accuracy: m.accuracy ?? null,
    priority: m.priority ?? 0,
    damageClass: m.damageClass || 'physical',
    meta: typeof m.meta === 'object' ? m.meta : (m.meta || {}),
  }));

  return {
    pokemonId: pokemonDoc.pokedexId,
    name: pokemonDoc.name,
    types: pokemonDoc.types,
    spriteUrl: pokemonDoc.spriteUrl,
    currentHp: maxHp,
    maxHp,
    battleStats: {
      attack: calcStat(pokemonDoc.baseStats.attack, ivs.attack),
      defense: calcStat(pokemonDoc.baseStats.defense, ivs.defense),
      specialAttack: calcStat(pokemonDoc.baseStats.specialAttack, ivs.specialAttack),
      specialDefense: calcStat(pokemonDoc.baseStats.specialDefense, ivs.specialDefense),
      speed: calcStat(pokemonDoc.baseStats.speed, ivs.speed),
    },
    ivs,
    moves: movesData,
    status: null,
    statusTurns: 0,
    statStages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  };
}
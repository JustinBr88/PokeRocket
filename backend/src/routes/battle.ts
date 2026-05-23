import { Hono } from 'hono';
import { Schema } from 'mongoose';
import { BattleModel, PokemonModel, MoveModel, MovesetModel, RoomModel, BattleHistoryModel, UserModel, TypeRelationModel, TeamModel } from '../models/index';
import { broadcastToRoom } from '../ws/roomRegistry';

const battle = new Hono();

// POST /api/battle/start — create battle from room
battle.post('/start', async c => {
  const { roomCode } = await c.req.json();
  const result = await startBattle(roomCode);
  if (result.error) return c.json({ error: result.error }, (result.status ?? 400) as any);
  return c.json(result);
});

// Exportable battle start function for use by other routes (e.g., rooms.ts)
export async function startBattle(roomCode: string) {
  const room = await RoomModel.findOne({ code: roomCode });
  if (!room) return { error: 'Room not found', status: 404 };
  if (room.players.length !== 2) return { error: 'Need 2 players', status: 400 };
  if (!room.players.every((p: any) => p.teamReady)) return { error: 'Players not team-ready', status: 400 };

  // Prevent duplicate battle creation
  const existingBattle = await BattleModel.findOne({ roomCode });
  if (existingBattle) return { error: 'Battle already started', status: 400 };

  // Get teams for both players
  const [bluePlayer, redPlayer] = room.players;
  const blueTeam = await TeamModel.findOne({ odiserId: bluePlayer.odiserId }).lean();
  const redTeam = await TeamModel.findOne({ odiserId: redPlayer.odiserId }).lean();

  if (!blueTeam || !redTeam) {
    return { error: 'Both players need a team', status: 400 };
  }

  // Load type cache first (needed for battle engine)
  const typeRelations = await TypeRelationModel.find().lean();
  const { loadTypeCache, buildBattlePokemon, selectBattleMusic } = await import('../services/battleEngine.js');
  await loadTypeCache(typeRelations);

  // Build battle teams
  // For each Pokemon in team, get the 4 famous moves from MovesetModel
  const blueBattleTeam = [];
  for (const p of blueTeam.pokemons) {
    const pokeDoc = await PokemonModel.findOne({ pokedexId: p.pokemonId }).lean();
    // Get moveset and filter for famous (featured) moves
    const moveset = await MovesetModel.findOne({ pokemonId: p.pokemonId }).lean();
    const famousMoves = (moveset?.moves || []).filter((m: any) => m.famous).slice(0, 4);
    // Get full move documents for the famous moves
    const moveDocs = await MoveModel.find({ pokeApiId: { $in: famousMoves.map((m: any) => m.moveId) } }).lean();
    const bp = await buildBattlePokemon(pokeDoc, moveDocs, 'blue');
    blueBattleTeam.push(bp);
  }

  const redBattleTeam = [];
  for (const p of redTeam.pokemons) {
    const pokeDoc = await PokemonModel.findOne({ pokedexId: p.pokemonId }).lean();
    const moveset = await MovesetModel.findOne({ pokemonId: p.pokemonId }).lean();
    const famousMoves = (moveset?.moves || []).filter((m: any) => m.famous).slice(0, 4);
    const moveDocs = await MoveModel.find({ pokeApiId: { $in: famousMoves.map((m: any) => m.moveId) } }).lean();
    const bp = await buildBattlePokemon(pokeDoc, moveDocs, 'red');
    redBattleTeam.push(bp);
  }

  // Verify Premium status for both players
  const player1User = await UserModel.findOne({ odiserId: bluePlayer.odiserId });
  const player2User = await UserModel.findOne({ odiserId: redPlayer.odiserId });

  const player1HasPremium = player1User?.isPremium ?? false;
  const player2HasPremium = player2User?.isPremium ?? false;
  const hasAnyPremium = player1HasPremium || player2HasPremium;

  console.log(`[BATTLE] Premium detected: P1=${player1HasPremium} P2=${player2HasPremium}`);

  // Select battle music based on premium status
  const selectedBattleMusic = selectBattleMusic(room.mode as 'casual' | 'ranked', hasAnyPremium);

  // Create battle document
  const battleDoc = await BattleModel.create({
    roomCode,
    turn: 1,
    status: 'active',
    players: [
      { odiserId: bluePlayer.odiserId, name: bluePlayer.name, side: 'blue', team: blueBattleTeam, activePokemonIdx: 0 },
      { odiserId: redPlayer.odiserId, name: redPlayer.name, side: 'red', team: redBattleTeam, activePokemonIdx: 0 },
    ],
    battleLog: ['Battle started!'],
    winnerUserId: null,
  });

  // Update room status using updateOne to avoid document save conflicts
  await RoomModel.updateOne(
    { code: roomCode },
    { $set: { status: 'battling' } }
  );

  // Broadcast battle started with music selection
  broadcastToRoom(roomCode, {
    type: 'BATTLE_STARTED',
    battle: battleDoc.toObject(),
    premiumInfo: {
      player1HasPremium,
      player2HasPremium,
    },
    selectedBattleMusic,
  });

  console.log(`[BATTLE] Music: ${selectedBattleMusic}`);

  return { ok: true, battle: battleDoc.toObject(), battleId: battleDoc._id };
}

// POST /api/battle/:roomCode/action
battle.post('/:roomCode/action', async c => {
  try {
    const { playerId, type, moveId, pokemonId } = await c.req.json();
    const roomCode = c.req.param('roomCode');
    const b = await BattleModel.findOne({ roomCode });
    if (!b) {
      console.log(`[Battle] Room ${roomCode} not found`);
      return c.json({ error: 'Battle not found' }, 404);
    }
    if (b.status !== 'active') {
      console.log(`[Battle] Battle ${roomCode} not active, status: ${b.status}`);
      return c.json({ error: 'Battle not active' }, 400);
    }

    const player = b.players.find((p: any) => p.odiserId === playerId);
    if (!player) {
      console.log(`[Battle] Player ${playerId} not in battle ${roomCode}`);
      return c.json({ error: 'Player not in this battle' }, 403);
    }
    if (player.selectedAction) {
      // If already submitted, check if it's stale (from previous turn)
      if (player.selectedActionTurn && player.selectedActionTurn < b.turn) {
        // Stale action - clear it and allow new submission
        console.log(`[Battle] Clearing stale action for ${playerId} (turn ${player.selectedActionTurn} vs current ${b.turn})`);
        player.selectedAction = null;
        player.selectedActionTurn = null;
      } else {
        console.log(`[Battle] Player ${playerId} already submitted:`, player.selectedAction);
        return c.json({ error: 'Already submitted this turn' }, 400);
      }
    }

    const active = player.team[player.activePokemonIdx];
    if (!active || active.currentHp == null || active.currentHp <= 0) {
      console.log(`[Battle] Player ${playerId} active pokemon is fainted or invalid`);
      return c.json({ error: 'Active Pokemon is fainted' }, 400);
    }

    if (type === 'move') {
      // Validation: move must exist in the Pokemon's moves array
      const moveIdNum = Number(moveId);
      const valid = active.moves.find((m: any) => Number(m.moveId) === moveIdNum);
      if (!valid) {
        console.log(`[Battle] Invalid move ${moveIdNum} for player ${playerId}`);
        return c.json({ error: 'Invalid move' }, 400);
      }
      player.selectedAction = { type: 'move', moveId: String(moveIdNum) };
      player.selectedActionTurn = b.turn;
    } else if (type === 'switch') {
      const target = player.team.find(
        (p: any, i: number) => i !== player.activePokemonIdx && p.currentHp > 0 && String(p.pokemonId) === pokemonId,
      );
      if (!target) {
        console.log(`[Battle] Invalid switch target ${pokemonId} for player ${playerId}`);
        return c.json({ error: 'Invalid switch target' }, 400);
      }
      player.selectedAction = { type: 'switch', pokemonId };
      player.selectedActionTurn = b.turn;
    } else if (type === 'heal') {
      // Heal action: restores 30% HP but loses turn (no damage dealt)
      player.selectedAction = { type: 'heal' };
      player.selectedActionTurn = b.turn;
    } else {
      console.log(`[Battle] Unknown action type: ${type}`);
      return c.json({ error: 'Unknown action type' }, 400);
    }

    console.log(`[Battle] Player ${playerId} submitted:`, player.selectedAction);
    await b.save();

    const bothReady = b.players.every((p: any) => p.selectedAction !== null);
    console.log(`[Battle] Both ready: ${bothReady}, turn: ${b.turn}`);
    if (bothReady) {
      // Import battle engine dynamically to avoid circular deps
      const { resolveTurn } = await import('../services/battleEngine.js');
      await resolveTurn(roomCode);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('[Battle] Action error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/battle/:roomCode — fetch current state
battle.get('/:roomCode', async c => {
  const b = await BattleModel.findOne({ roomCode: c.req.param('roomCode') }).lean();
  if (!b) return c.json({ error: 'Not found' }, 404);
  return c.json(b);
});

// POST /api/battle/:roomCode/reset — delete battle document for rematch
battle.post('/:roomCode/reset', async c => {
  const roomCode = c.req.param('roomCode');

  // Delete the battle document
  await BattleModel.deleteOne({ roomCode });

  // Update room status to 'teams' (ready for new battle)
  await RoomModel.updateOne(
    { code: roomCode },
    {
      $set: {
        status: 'teams',
        'players.$[].teamReady': false,
      },
    }
  );

  // Also clear rematchRequested via a separate update
  await RoomModel.updateOne(
    { code: roomCode },
    { $set: { rematchRequested: {} } }
  );

  return c.json({ ok: true });
});

export default battle;
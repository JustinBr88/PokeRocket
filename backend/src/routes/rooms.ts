import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { RoomModel, BattleModel, PokemonModel, ChatMessageModel } from '../models/index';
import { broadcastToRoom } from '../ws/roomRegistry';

const rooms = new Hono();

// GET /api/rooms?mode=casual|ranked&status=waiting
rooms.get('/', async c => {
  const mode = c.req.query('mode');
  const status = c.req.query('status') ?? 'waiting';
  const filter: Record<string, unknown> = { status };
  if (mode) filter.mode = mode;
  const data = await RoomModel.find(filter).lean();
  return c.json(data);
});

// POST /api/rooms — create room
rooms.post('/', async c => {
  const { name, mode, odiserId } = await c.req.json<{ name: string; mode: 'casual' | 'ranked'; odiserId: string }>();
  const code = nanoid(6).toUpperCase();
  const room = await RoomModel.create({
    code,
    mode,
    players: [{ odiserId, name, side: 'blue', ready: false }],
    status: 'waiting',
  });
  return c.json({ code, playerId: odiserId });
});

// POST /api/rooms/:code/join
rooms.post('/:code/join', async c => {
  const { name, odiserId } = await c.req.json<{ name: string; odiserId: string }>();
  const room = await RoomModel.findOne({ code: c.req.param('code') });
  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.players.length >= 2) return c.json({ error: 'Room full' }, 400);
  const alreadyInRoom = room.players.some((p: any) => p.odiserId === odiserId);
  if (alreadyInRoom) return c.json({ error: 'Player already in room' }, 400);
  room.players.push({ odiserId, name, side: 'red', ready: false });
  await room.save();
  return c.json({ code: room.code, playerId: odiserId });
});

// GET /api/rooms/:code
rooms.get('/:code', async c => {
  const room = await RoomModel.findOne({ code: c.req.param('code') }).lean();
  if (!room) return c.json({ error: 'Room not found' }, 404);
  return c.json(room);
});

// GET /api/rooms/:code/chat — load chat history
rooms.get('/:code/chat', async c => {
  const code = c.req.param('code');
  const messages = await ChatMessageModel.find({ roomCode: code })
    .sort({ timestamp: 1 })
    .lean();
  return c.json(messages);
});

// POST /api/rooms/:code/ready
rooms.post('/:code/ready', async c => {
  const { odiserId } = await c.req.json<{ odiserId: string }>();
  const code = c.req.param('code') ?? '';
  const room = await RoomModel.findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);

  const player = room.players.find((p: any) => p.odiserId === odiserId);
  if (!player) return c.json({ error: 'Player not in room' }, 404);

  player.ready = true;
  await room.save();

  // Broadcast PLAYER_READY so the other player sees the update in real-time
  const roomCode = room.code as string;
  broadcastToRoom(roomCode, { type: 'PLAYER_READY', odiserId, roomCode });

  // Check if both players are ready
  const bothReady = room.players.every((p: any) => p.ready);
  if (bothReady) {
    broadcastToRoom(roomCode, { type: 'LOBBY_READY', roomCode });
  }

  return c.json({ ok: true, bothReady });
});

// POST /api/rooms/:code/team-ready — mark team as ready and notify other player
rooms.post('/:code/team-ready', async c => {
  const { odiserId } = await c.req.json<{ odiserId: string }>();
  const code = c.req.param('code') ?? '';
  const room = await RoomModel.findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);

  const player = room.players.find((p: any) => p.odiserId === odiserId);
  if (!player) return c.json({ error: 'Player not in room' }, 404);

  player.teamReady = true;
  await room.save();

  // Broadcast TEAM_READY so the other player sees the update in real-time
  const roomCode = room.code as string;
  broadcastToRoom(roomCode, { type: 'TEAM_READY', odiserId, roomCode });

  // Check if both players are teamReady
  const bothTeamReady = room.players.every((p: any) => p.teamReady);
  if (bothTeamReady) {
    // Broadcast BOTH_TEAMS_READY — frontend will call POST /api/battle/start
    broadcastToRoom(roomCode, { type: 'BOTH_TEAMS_READY', roomCode });
  }

  return c.json({ ok: true, bothTeamReady });
});

// DELETE /api/rooms/:code/team-ready — cancel team ready status
rooms.delete('/:code/team-ready', async c => {
  const { odiserId } = await c.req.json<{ odiserId: string }>();
  const code = c.req.param('code') ?? '';
  const room = await RoomModel.findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);

  const player = room.players.find((p: any) => p.odiserId === odiserId);
  if (!player) return c.json({ error: 'Player not in room' }, 404);

  player.teamReady = false;
  await room.save();

  // Broadcast TEAM_CANCELLED so the other player sees the update
  const roomCodeCancel = room.code as string;
  broadcastToRoom(roomCodeCancel, { type: 'TEAM_CANCELLED', odiserId, roomCode: roomCodeCancel });

  return c.json({ ok: true });
});

// POST /api/rooms/:code/rematch — request rematch
rooms.post('/:code/rematch', async c => {
  const { odiserId } = await c.req.json();
  const code = c.req.param('code');
  const room = await RoomModel.findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);

  // Set rematchRequested for this player
  if (!room.rematchRequested) room.rematchRequested = {};
  room.rematchRequested.set(odiserId, true);
  await room.save();

  // Broadcast to the other player
  broadcastToRoom(code, { type: 'REMATCH_REQUESTED', odiserId, roomCode: code });

  // Check if both players requested rematch
  const playerIds = room.players.map((p: any) => p.odiserId);
  const bothRequested = playerIds.every(id => room.rematchRequested?.get(id) === true);

  if (bothRequested) {
    // Reset room for rematch
    room.status = 'teams';
    room.rematchRequested = {};
    // Reset teamReady for both players
    for (const player of room.players) {
      (player as any).teamReady = false;
    }
    await room.save();

    // Broadcast that both are ready for rematch
    broadcastToRoom(code, { type: 'REMATCH_BOTH_READY', roomCode: code });
  }

  return c.json({ ok: true, bothRequested });
});

// DELETE /api/rooms/:code/rematch — cancel rematch request
rooms.delete('/:code/rematch', async c => {
  const { odiserId } = await c.req.json();
  const code = c.req.param('code');
  const room = await RoomModel.findOne({ code });
  if (!room) return c.json({ error: 'Room not found' }, 404);

  // Clear rematchRequested for this player
  if (room.rematchRequested) {
    room.rematchRequested.delete(odiserId);
  }
  await room.save();

  // Broadcast cancellation
  broadcastToRoom(code, { type: 'REMATCH_CANCELLED', odiserId, roomCode: code });

  return c.json({ ok: true });
});

// DELETE /api/rooms/:code — delete room and associated chat messages
rooms.delete('/:code', async c => {
  const code = c.req.param('code');
  
  // Delete all chat messages for this room
  await ChatMessageModel.deleteMany({ roomCode: code });
  
  // Delete the room itself
  await RoomModel.deleteOne({ code });
  
  return c.json({ ok: true });
});

export default rooms;
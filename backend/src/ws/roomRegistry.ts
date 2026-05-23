import type { ServerWebSocket } from 'bun';

export interface WsData {
  playerId: string;
  roomCode: string;
}

export interface RoomClient {
  ws: ServerWebSocket<WsData>;
  playerId: string;
  roomCode: string;
}

// Map: roomCode → array of connected clients
const rooms = new Map<string, RoomClient[]>();

export function joinRoom(roomCode: string, client: RoomClient) {
  const list = rooms.get(roomCode) ?? [];
  list.push(client);
  rooms.set(roomCode, list);
}

export function leaveRoom(roomCode: string, ws: ServerWebSocket<WsData>) {
  const list = rooms.get(roomCode) ?? [];
  rooms.set(
    roomCode,
    list.filter(c => c.ws !== ws),
  );
}

export function broadcastToRoom(roomCode: string, payload: unknown) {
  const list = rooms.get(roomCode) ?? [];
  const msg = JSON.stringify(payload);
  for (const client of list) {
    if (client.ws.readyState === 1 /* OPEN */) {
      client.ws.send(msg);
    }
  }
}

export function sendToPlayer(
  roomCode: string,
  playerId: string,
  payload: unknown,
) {
  const list = rooms.get(roomCode) ?? [];
  const msg = JSON.stringify(payload);
  const target = list.find(c => c.playerId === playerId);
  if (target && target.ws.readyState === 1) target.ws.send(msg);
}
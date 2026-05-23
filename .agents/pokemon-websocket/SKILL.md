---
name: pokemon-websocket
description: >
  Implement real-time bidirectional communication for the Pokémon Battle Rooms
  project using WebSockets (via Hono + Bun). Use this skill whenever you need
  to push battle state, lobby updates, or turn results to both players without
  polling or manual page refreshes. Covers server-side WebSocket handling in
  Hono/Bun, room-based broadcasting, reconnection logic, and the React client
  hook that consumes the socket. Trigger for any feature that requires live
  updates: lobby waiting, turn submission, battle log streaming, or victory
  notification.
---

# WebSocket Skill — Pokémon Battle Rooms (Hono + Bun)

## 1 · Why WebSockets instead of polling

| Concern | Polling | WebSockets |
|---|---|---|
| Latency | High (≥1 s round-trip) | Near-zero push |
| Server load | Many redundant requests | Single persistent connection |
| Battle log | Players see results at different times | Both see results simultaneously |
| Lobby | Must poll for second player | Server pushes "player joined" instantly |

**Rule**: never use `setInterval` + fetch for battle state. Use WebSockets for all live events.

---

## 2 · Server-side WebSocket setup (Hono + Bun)

Bun has a native, fast WebSocket API. Hono wraps it cleanly.

### 2.1 Install / versions

```bash
# No extra packages needed — Bun ships WebSocket support natively
# Hono WebSocket helper (bundled with hono)
bun add hono
```

### 2.2 Room registry (in-memory, server singleton)

```ts
// src/ws/roomRegistry.ts
import type { ServerWebSocket } from 'bun';

export interface RoomClient {
  ws: ServerWebSocket<WsData>;
  playerId: string;
  roomCode: string;
}

export interface WsData {
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
```

### 2.3 WebSocket upgrade route (Hono)

```ts
// src/routes/ws.ts
import { Hono } from 'hono';
import { joinRoom, leaveRoom, broadcastToRoom } from '../ws/roomRegistry';

const wsRoute = new Hono();

wsRoute.get('/ws/:roomCode/:playerId', c => {
  const { roomCode, playerId } = c.req.param();

  // Bun-specific WebSocket upgrade
  const upgraded = Bun.upgradeWebSocket(c.req.raw, {
    data: { roomCode, playerId } as WsData,
    open(ws) {
      joinRoom(roomCode, { ws, playerId, roomCode });
      broadcastToRoom(roomCode, {
        type: 'PLAYER_CONNECTED',
        playerId,
        roomCode,
      });
    },
    message(ws, raw) {
      // All client→server messages go through REST endpoints instead.
      // This handler is here for ping/keepalive only.
      const msg = JSON.parse(raw as string);
      if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
    },
    close(ws) {
      leaveRoom(roomCode, ws);
      broadcastToRoom(roomCode, {
        type: 'PLAYER_DISCONNECTED',
        playerId,
        roomCode,
      });
    },
  });

  if (upgraded) return upgraded;
  return c.text('WebSocket upgrade failed', 400);
});

export default wsRoute;
```

### 2.4 Mount on the Hono app

```ts
// src/index.ts
import { Hono } from 'hono';
import wsRoute from './routes/ws';
import battleRoute from './routes/battle';

const app = new Hono();

app.route('/', wsRoute);
app.route('/api', battleRoute);

export default {
  port: 3001,
  fetch: app.fetch,
  // Bun requires websocket handler at the top level
  websocket: {
    open(ws)    { /* handled inside route */ },
    message(ws, msg) { /* handled inside route */ },
    close(ws)   { /* handled inside route */ },
  },
};
```

> **Important**: Bun's WebSocket handler must be exported alongside `fetch`. The route-level handlers (`open`, `message`, `close`) are closures with access to `data` set during `upgradeWebSocket`.

### 2.5 Broadcasting from battle resolver

After resolving a turn (inside the battle service), call `broadcastToRoom` with the new full battle state:

```ts
// src/services/battleService.ts
import { broadcastToRoom } from '../ws/roomRegistry';

export async function resolveTurn(roomCode: string) {
  // ... compute new battle state ...
  await BattleModel.findOneAndUpdate({ roomCode }, newState);

  // Push to both players immediately
  broadcastToRoom(roomCode, {
    type: 'TURN_RESOLVED',
    battle: newState,
  });

  if (newState.status === 'finished') {
    broadcastToRoom(roomCode, {
      type: 'BATTLE_ENDED',
      winnerPlayerId: newState.winnerPlayerId,
    });
  }
}
```

---

## 3 · Message type catalogue

Define a shared `WsMessage` discriminated union. Keep it in a types file imported by both server and (if using a monorepo) the client.

```ts
// src/types/wsMessages.ts

export type WsMessage =
  | { type: 'PLAYER_CONNECTED';    playerId: string; roomCode: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; roomCode: string }
  | { type: 'LOBBY_READY';         players: { id: string; name: string }[] }
  | { type: 'BATTLE_STARTED';      battle: BattleState }
  | { type: 'TURN_RESOLVED';       battle: BattleState }
  | { type: 'BATTLE_ENDED';        winnerPlayerId: string }
  | { type: 'ERROR';               message: string }
  | { type: 'PING' }
  | { type: 'PONG' };
```

**Invariants**:
- The server **never** expects clients to send game actions over the WebSocket. Actions go via `POST /api/battle/:roomCode/action`.
- The WebSocket is **server → client push only** (except PING).
- Always include the full `BattleState` in `TURN_RESOLVED` so the client is always in sync; never send diffs.

---

## 4 · Client-side React hook

### 4.1 `useBattleSocket` hook

```ts
// src/hooks/useBattleSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsMessage } from '../types/wsMessages';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

interface Options {
  roomCode: string;
  playerId: string;
  onMessage: (msg: WsMessage) => void;
}

export function useBattleSocket({ roomCode, playerId, onMessage }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage; // always latest handler

  const connect = useCallback(() => {
    const url = `${WS_URL}/ws/${roomCode}/${playerId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      clearTimeout(reconnectTimer.current);
      // Start heartbeat
      const hb = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'PING' }));
      }, 25_000);
      ws.addEventListener('close', () => clearInterval(hb));
    };

    ws.onmessage = event => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type !== 'PONG') onMessageRef.current(msg);
      } catch {
        console.warn('[WS] Failed to parse message', event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 2 s
      reconnectTimer.current = setTimeout(connect, 2_000);
    };

    ws.onerror = err => console.error('[WS] Error', err);

    wsRef.current = ws;
  }, [roomCode, playerId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
```

### 4.2 Using the hook in the Battle page

```tsx
// src/pages/BattlePage.tsx
import { useBattleSocket } from '../hooks/useBattleSocket';
import { useState } from 'react';
import type { BattleState } from '../types/battle';
import type { WsMessage } from '../types/wsMessages';

export function BattlePage({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [winner, setWinner]  = useState<string | null>(null);

  const { connected } = useBattleSocket({
    roomCode,
    playerId,
    onMessage(msg: WsMessage) {
      switch (msg.type) {
        case 'BATTLE_STARTED':
        case 'TURN_RESOLVED':
          setBattle(msg.battle);
          break;
        case 'BATTLE_ENDED':
          setWinner(msg.winnerPlayerId);
          break;
        default:
          break;
      }
    },
  });

  // Submit action via REST (not WebSocket)
  async function submitAction(action: { type: 'move' | 'switch'; payload: unknown }) {
    await fetch(`/api/battle/${roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ...action }),
    });
    // No need to update state here — the WebSocket will push TURN_RESOLVED
  }

  return (
    <div>
      {!connected && <div className="ws-status">Reconnecting…</div>}
      {/* render battle UI */}
    </div>
  );
}
```

---

## 5 · Lobby WebSocket flow

```
Player 1 creates room via POST /api/rooms
  → GET /ws/:roomCode/:player1Id  (connects, sees PLAYER_CONNECTED for self)

Player 2 joins room via POST /api/rooms/:code/join
  → GET /ws/:roomCode/:player2Id  (connects)
  → Server broadcasts PLAYER_CONNECTED (player2) to both
  → Server detects room is full → broadcasts LOBBY_READY
  → Both clients navigate to team selection / battle

[Team selection complete]
POST /api/rooms/:code/ready  (both players)
  → Server starts battle, broadcasts BATTLE_STARTED with full BattleState
```

---

## 6 · Docker / CORS configuration

When running behind Docker Compose, ensure:

```yaml
# docker-compose.yml (relevant excerpt)
services:
  backend:
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
```

```ts
// Add CORS for WebSocket upgrade (Hono cors middleware)
import { cors } from 'hono/cors';
app.use('/*', cors({ origin: 'http://localhost:5173' }));
```

Frontend `.env`:

```
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001/api
```

---

## 7 · Checklist

- [ ] WebSocket URL uses `ws://` (dev) or `wss://` (prod with TLS)
- [ ] Client reconnects automatically on disconnect (2 s back-off)
- [ ] Heartbeat PING sent every 25 s to keep connection alive through proxies
- [ ] `onMessage` callback ref pattern prevents stale closure bugs
- [ ] Server never sends partial state — always full `BattleState`
- [ ] Game actions go via `POST` REST, not via WebSocket send
- [ ] `broadcastToRoom` called from battle service after every resolved turn
- [ ] Room registry cleaned up when both players disconnect
- [ ] `BATTLE_ENDED` message sent **after** DB is updated with winner
- [ ] Connection status indicator shown in UI when disconnected

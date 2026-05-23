import type { ServerWebSocket } from 'bun';
import { joinRoom, leaveRoom, broadcastToRoom, type WsData, type RoomClient } from './roomRegistry';
import { ChatMessageModel } from '../models/index';

/**
 * WebSocket lifecycle handlers for Bun
 * 
 * The upgrade logic is in index.ts's fetch() function
 * These handlers manage the lifecycle after a successful upgrade
 */
export const wsHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    const { roomCode, playerId } = ws.data;
    
    try {
      console.log(`[WS] Player ${playerId} opening connection to room ${roomCode}`);
      
      // Register client
      const client: RoomClient = { ws, playerId, roomCode };
      joinRoom(roomCode, client);
      
      // Notify others — note: imageUrl will be sent by frontend in subsequent message
      broadcastToRoom(roomCode, {
        type: 'PLAYER_CONNECTED',
        playerId,
        roomCode,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[WS] Error in open handler:', err);
      ws.close(1011, 'Server error');
    }
  },

  message: async (ws: ServerWebSocket<WsData>, raw: string | Buffer) => {
    const { roomCode, playerId } = ws.data;
    
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
      
      // Handle PING
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        return;
      }

      // Handle JOIN_ROOM - send player's image to others
      if (msg.type === 'JOIN_ROOM') {
        broadcastToRoom(roomCode, {
          type: 'PLAYER_CONNECTED',
          playerId,
          playerImageUrl: msg.playerImageUrl,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      // Handle CHAT_MESSAGE
      if (msg.type === 'CHAT_MESSAGE') {
        // Save message to database
        const savedMsg = await ChatMessageModel.create({
          roomCode: msg.roomCode,
          playerId: msg.playerId,
          name: msg.name,
          text: msg.text,
          timestamp: new Date(),
        });

        // Broadcast to room with timestamp from saved document, preserving clientId for deduplication
        broadcastToRoom(msg.roomCode, {
          type: 'CHAT_MESSAGE',
          playerId: msg.playerId,
          name: msg.name,
          text: msg.text,
          timestamp: savedMsg.timestamp.toISOString(),
          playerImageUrl: msg.playerImageUrl,
          clientId: msg.clientId,
        });
        return;
      }
      
      console.log(`[WS] Unhandled message type: ${msg.type}`);
    } catch (err) {
      console.error('[WS] Error parsing message:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
    }
  },

  close(ws: ServerWebSocket<WsData>) {
    const { roomCode, playerId } = ws.data;
    
    try {
      console.log(`[WS] Player ${playerId} closing connection from room ${roomCode}`);
      
      // Unregister client
      leaveRoom(roomCode, ws);
      
      // Notify others
      broadcastToRoom(roomCode, {
        type: 'PLAYER_DISCONNECTED',
        playerId,
        roomCode,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[WS] Error in close handler:', err);
    }
  },

  error(ws: ServerWebSocket<WsData>, err: Error) {
    const { roomCode, playerId } = ws.data;
    console.error(`[WS] Error for player ${playerId} in room ${roomCode}:`, err);
  },
};

import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from './sprites';
import type { WsMessage } from '../types';

interface UseBattleSocketOptions {
  roomCode: string;
  playerId: string;
  onMessage: (msg: WsMessage) => void;
  enabled?: boolean;
}

export function useBattleSocket({ roomCode, playerId, onMessage, enabled = true }: UseBattleSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const url = `${WS_URL}/ws/${roomCode}/${playerId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      clearTimeout(reconnectTimer.current);
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
      reconnectTimer.current = setTimeout(connect, 2_000);
    };

    ws.onerror = err => console.error('[WS] Error', err);
    wsRef.current = ws;
  }, [roomCode, playerId]);

  useEffect(() => {
    if (!enabled || !roomCode || !playerId) {
      // Clean up existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, enabled, roomCode, playerId]);

  return { connected };
}
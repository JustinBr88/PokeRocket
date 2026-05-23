/**
 * MusicProvider - Component que controla música según ruta
 * Debe envolver la app en main.tsx
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMusicManager } from '../lib/musicManager';
import { useMusicStore } from '../stores/musicStore';
import { useBattleSocket } from '../lib/useBattleSocket';
import type { WsMessage } from '../types';
import { useAuth } from '@clerk/clerk-react';

// Mapeo de rutas a archivos de música
const MUSIC_MAP: Record<string, string> = {
  '/': 'sonidos/Music/Musica_Titulo.mp3',
  '/title': 'sonidos/Music/Musica_Titulo.mp3',
  '/home': 'sonidos/Music/Musica_Home.mp3',
  '/pokedex': 'sonidos/Music/Musica_Pokedex.mp3',
  '/rules': 'sonidos/Music/Musica_Pokedex.mp3',
  '/premium': 'sonidos/Music/Musica_Pokedex.mp3',
  '/room': 'sonidos/Music/Musica_Lobby.mp3',
  '/play': 'sonidos/Music/Musica_Home.mp3',
  '/teams': 'sonidos/Music/Musica_Lobby.mp3',
  '/battle': 'sonidos/Music/Batalla_Casual.mp3', // Default casual
  '/results': 'sonidos/Music/Victoria_Casual.mp3', // Default victory
  '/leaderboards': 'sonidos/Music/Musica_Home.mp3', // Reutilizar música de home
  '/history': 'sonidos/Music/Musica_Home.mp3', // Reutilizar música de home
  '/login': 'sonidos/Music/Musica_Titulo.mp3',
};

/**
 * Obtiene la música correcta basada en la ruta actual y contexto de batalla
 */
function getMusicForRoute(pathname: string, battleMode?: string | null, battleResult?: string | null): string {
  // Extraer la ruta base (sin parámetros)
  const baseRoute = pathname.split('/').slice(0, 2).join('/') || '/';

  // Caso especial: /battle con contexto de modo
  if (baseRoute === '/battle' && battleMode) {
    return battleMode === 'ranked'
      ? 'sonidos/Music/Batalla_Ranked.mp3'
      : 'sonidos/Music/Batalla_Casual.mp3';
  }

  // Caso especial: /results con contexto de resultado
  if (baseRoute === '/results' && battleResult && battleMode) {
    if (battleResult === 'victory') {
      return battleMode === 'ranked'
        ? 'sonidos/Music/Victoria_Ranked.mp3'
        : 'sonidos/Music/Victoria_Casual.mp3';
    } else {
      return battleMode === 'ranked'
        ? 'sonidos/Music/Derrota_Ranked.mp3'
        : 'sonidos/Music/Derrota_Casual.mp3';
    }
  }

  // Fallback a MUSIC_MAP
  const defaultMusic = MUSIC_MAP[baseRoute] || MUSIC_MAP['/home'];
  return defaultMusic;
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { userId } = useAuth();
  const { battleMode, battleResult, setCurrentMusic, setIsPlaying, clearBattleContext } = useMusicStore();
  const [selectedBattleMusic, setSelectedBattleMusic] = useState<string | null>(null);

  // Only setup battle socket when in battle route with valid roomCode
  const roomCode = location.pathname.includes('/battle/')
    ? location.pathname.split('/battle/')[1]?.split('/')[0]
    : null;

  // Only connect to battle socket when we have a valid roomCode and playerId
  const playerId = userId ?? null;
  const shouldConnectBattleSocket = roomCode && playerId && roomCode.length > 0;

  // Handle WS messages to capture selectedBattleMusic
  const handleWsMessage = (msg: WsMessage) => {
    if (msg.type === 'BATTLE_STARTED' && msg.selectedBattleMusic) {
      setSelectedBattleMusic(msg.selectedBattleMusic);
      console.log(`[MUSIC] Battle music selected: ${msg.selectedBattleMusic}`);
    }
  };

  // Setup battle socket only when in battle with valid context
  useBattleSocket({
    roomCode: shouldConnectBattleSocket ? roomCode ?? '' : '',
    playerId: shouldConnectBattleSocket ? playerId ?? '' : '',
    onMessage: shouldConnectBattleSocket ? handleWsMessage : () => {},
    enabled: Boolean(shouldConnectBattleSocket),
  });

  // Reset battle music and context when leaving battle/results routes
  useEffect(() => {
    const isBattleOrResultsRoute = location.pathname.includes('/battle') || location.pathname.includes('/results');
    if (!isBattleOrResultsRoute) {
      setSelectedBattleMusic(null);
      // Clear battle context when leaving battle/results pages
      clearBattleContext();
    }
  }, [location.pathname]);

  useEffect(() => {
    const musicManager = getMusicManager();
    const pathname = location.pathname;
    const baseRoute = pathname.split('/').slice(0, 2).join('/') || '/';

    // Si estamos en /battle y tenemos música seleccionada, usarla
    if (baseRoute === '/battle' && selectedBattleMusic) {
      if (musicManager.getCurrentPath() !== `/${selectedBattleMusic}`) {
        musicManager.stopMusic(0); // stop immediately before switching
        musicManager.playMusic(selectedBattleMusic, 300).then(() => {
          setCurrentMusic(selectedBattleMusic);
          setIsPlaying(true);
        });
      }
    } else if (baseRoute === '/battle' && !selectedBattleMusic) {
      // In battle but no selectedBattleMusic yet — force stop lobby music to prevent overlap
      musicManager.stopMusic(0);
    } else if (baseRoute !== '/battle') {
      // Si salimos de batalla o no estamos en batalla, reproducir música normal
      const normalMusic = getMusicForRoute(pathname, battleMode, battleResult);
      if (musicManager.getCurrentPath() !== `/${normalMusic}`) {
        musicManager.playMusic(normalMusic, 300).then(() => {
          setCurrentMusic(normalMusic);
          setIsPlaying(true);
        });
      }
    }
  }, [location.pathname, selectedBattleMusic, battleMode, battleResult, setCurrentMusic, setIsPlaying]);

  return <>{children}</>;
}

export { MUSIC_MAP, getMusicForRoute };

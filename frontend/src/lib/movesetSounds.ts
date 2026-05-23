/**
 * Utilidades para reproducir sonidos de movimientos en batalla
 */

/**
 * Obtiene el path del sonido para un movimiento
 * @param moveName - Nombre del movimiento (ej: "Thunderbolt")
 * @returns El path relativo al archivo de sonido
 */
export function getMoveSoundPath(moveName: string): string {
  return `sonidos/Attack Moves/${moveName}.mp3`;
}

/**
 * Reproduce el sonido de un ataque
 * @param moveName - Nombre del movimiento
 * @param volume - Volumen (0-1, default 0.7)
 */
export async function playMoveSound(moveName: string, volume: number = 0.7): Promise<void> {
  try {
    const soundPath = getMoveSoundPath(moveName);
    const audio = new Audio(`/${soundPath}`);
    audio.volume = Math.max(0, Math.min(1, volume));

    await audio.play().catch((error) => {
      // Silenciar errores de audio (ej: autoplay policy)
      console.debug('Could not play attack sound:', moveName, error);
    });
  } catch (error) {
    console.error('Error playing move sound:', error);
  }
}

/**
 * Reproduce un sonido con opciones avanzadas
 * @param moveName - Nombre del movimiento
 * @param options - Opciones de reproducción
 */
export async function playSoundAdvanced(
  moveName: string,
  options: {
    volume?: number;
    playbackRate?: number;
    currentTime?: number;
  } = {}
): Promise<HTMLAudioElement> {
  const soundPath = getMoveSoundPath(moveName);
  const audio = new Audio(`/${soundPath}`);

  audio.volume = Math.max(0, Math.min(1, options.volume ?? 0.7));
  if (options.playbackRate) audio.playbackRate = options.playbackRate;
  if (options.currentTime) audio.currentTime = options.currentTime;

  try {
    await audio.play().catch((error) => {
      console.debug('Could not play advanced sound:', moveName, error);
    });
  } catch (error) {
    console.error('Error playing advanced sound:', error);
  }

  return audio;
}

/**
 * Verifica si un archivo de sonido existe (sin reproducirlo)
 * Nota: Esta función es aproximada - en una app real, necesitarías
 * una lista precargada de movimientos disponibles
 */
export function hasMoveSound(moveName: string): boolean {
  // Por ahora retornamos true asumiendo que la mayoría de movimientos tienen sonido
  // En producción, podrías precargar una lista de movimientos disponibles
  return !!moveName && moveName.length > 0;
}

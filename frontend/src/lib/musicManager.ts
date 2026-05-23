/**
 * MusicManager - Singleton para gestionar música de fondo
 * Controla reproducción con fade in/out suave
 */

interface MusicConfig {
  path: string;
  volume: number;
  loop: boolean;
}

class MusicManagerClass {
  private audio: HTMLAudioElement | null = null;
  private currentPath: string | null = null;
  private targetVolume: number = 0.3;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private isPlaying: boolean = false;

  /**
   * Inicializa o retorna la instancia de Audio
   */
  private getAudioElement(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.volume = this.targetVolume;
    }
    return this.audio;
  }

  /**
   * Inicia fade-out gradual de la música actual
   */
  private fadeOut(duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audio || !this.isPlaying) {
        resolve();
        return;
      }

      if (this.fadeInterval) clearInterval(this.fadeInterval);

      const startVolume = this.audio.volume;
      const startTime = Date.now();
      const stepTime = 50;
      const steps = duration / stepTime;
      const volumeDecrement = startVolume / steps;

      this.fadeInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= duration) {
          if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio.volume = 0;
          }
          this.isPlaying = false;
          if (this.fadeInterval) clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          resolve();
        } else if (this.audio) {
          this.audio.volume = Math.max(0, startVolume - volumeDecrement * (elapsed / stepTime));
        }
      }, stepTime);
    });
  }

  /**
   * Inicia fade-in gradual de la música
   */
  private fadeIn(duration: number = 300): void {
    if (!this.audio) return;

    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const startVolume = this.audio.volume;
    const startTime = Date.now();
    const stepTime = 50;
    const steps = duration / stepTime;
    const volumeIncrement = (this.targetVolume - startVolume) / steps;

    this.fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        if (this.audio) this.audio.volume = this.targetVolume;
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      } else if (this.audio) {
        this.audio.volume = startVolume + volumeIncrement * (elapsed / stepTime);
      }
    }, stepTime);
  }

  /**
   * Reproduce una canción
   */
  async playMusic(path: string, fadeInDuration: number = 300): Promise<void> {
    const audio = this.getAudioElement();

    // Si ya está tocando la misma canción, no hacer nada
    if (this.currentPath === path && this.isPlaying) {
      return;
    }

    // Fade out de música anterior si existe
    if (this.isPlaying && this.currentPath !== path) {
      await this.fadeOut(200);
    }

    // Cargar nueva canción
    this.currentPath = path;
    audio.src = `/${path}`; // Vite resuelve rutas relativas a /
    audio.volume = 0;
    audio.loop = true;

    try {
      await audio.play();
      this.isPlaying = true;
      this.fadeIn(fadeInDuration);
    } catch (error) {
      console.error('Error playing music:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Detiene la música con fade-out
   */
  async stopMusic(fadeDuration: number = 300): Promise<void> {
    if (!this.isPlaying) return;
    await this.fadeOut(fadeDuration);
    this.currentPath = null;
  }

  /**
   * Pausa la música sin detenerla
   */
  pauseMusic(): void {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
    }
  }

  /**
   * Reanuda la música
   */
  resumeMusic(): void {
    if (this.audio && this.currentPath) {
      this.audio.play().catch(console.error);
      this.isPlaying = true;
    }
  }

  /**
   * Establece el volumen de la música de fondo
   */
  setVolume(volume: number): void {
    this.targetVolume = Math.max(0, Math.min(1, volume));
    if (this.audio && this.isPlaying) {
      this.audio.volume = this.targetVolume;
    }
  }

  /**
   * Obtiene el volumen actual
   */
  getVolume(): number {
    return this.targetVolume;
  }

  /**
   * Obtiene el estado de reproducción
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Obtiene la ruta de la canción actual
   */
  getCurrentPath(): string | null {
    return this.currentPath;
  }
}

// Singleton instance
let instance: MusicManagerClass | null = null;

export function getMusicManager(): MusicManagerClass {
  if (!instance) {
    instance = new MusicManagerClass();
  }
  return instance;
}

export type { MusicConfig };

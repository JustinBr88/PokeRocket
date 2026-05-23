# Fase 5: Sistema de Música y Sonidos - Guía de Implementación

## Resumen de Cambios

### ✅ Archivos Creados

1. **`frontend/src/lib/musicManager.ts`** (111 líneas)
   - Singleton que controla reproducción de música de fondo
   - Fade in/out suave (300ms por default)
   - Métodos: playMusic(), stopMusic(), pauseMusic(), resumeMusic(), setVolume()

2. **`frontend/src/lib/movesetSounds.ts`** (61 líneas)
   - Funciones para reproducir sonidos de movimientos
   - `playMoveSound(moveName, volume)` - reproduce sonido de ataque
   - `getMoveSoundPath(moveName)` - obtiene ruta del archivo
   - `playSoundAdvanced()` - opciones de reproducción avanzadas
   - `hasMoveSound()` - verifica disponibilidad

3. **`frontend/src/stores/musicStore.ts`** (36 líneas)
   - Zustand store para estado de música global
   - Estado: currentMusic, isPlaying, volume, battleMode, battleResult
   - Acciones: setCurrentMusic, setVolume, setBattleContext

4. **`frontend/src/components/MusicProvider.tsx`** (91 líneas)
   - Componente que envuelve la app en main.tsx
   - Detecta cambios de ruta automáticamente
   - Mapeo de rutas a archivos de música
   - Manejo especial para /battle y /results con contexto

### ✅ Archivos Modificados

1. **`frontend/src/main.tsx`**
   - Agregado: Import de MusicProvider
   - Envuelto App dentro de `<MusicProvider>`

2. **`frontend/src/app/routes/battle.tsx`**
   - Agregado: Import de playMoveSound y useMusicStore
   - Agregado: setBattleContext en useEffect que fetch roomMode
   - Mejorado: handleMessage para reproducir sonido de ataque
   - Regex mejorada para extraer moveName del log

3. **`frontend/src/app/routes/results.tsx`**
   - Agregado: Import de useUser y useMusicStore
   - Agregado: Lógica para determinar victoria/derrota
   - Agregado: setBattleContext en useEffect cuando llega result

## Mapeo de Música por Ruta

| Ruta | Archivo | Notas |
|------|---------|-------|
| `/` y `/title` | Musica_Titulo.mp3 | Landing page |
| `/home`, `/rules`, `/leaderboards`, `/history` | Musica_Home.mp3 | Menú principal |
| `/pokedex` | Musica_Pokedex.mp3 | Pokédex |
| `/room`, `/play`, `/teams` | Musica_Lobby.mp3 | Lobby y team builder |
| `/battle` (casual) | Batalla_Casual.mp3 | Batalla casual |
| `/battle` (ranked) | Batalla_Ranked.mp3 | Batalla ranked |
| `/results` (victoria casual) | Victoria_Casual.mp3 | Victoria casual |
| `/results` (derrota casual) | Derrota_Casual.mp3 | Derrota casual |
| `/results` (victoria ranked) | Victoria_Ranked.mp3 | Victoria ranked |
| `/results` (derrota ranked) | Derrota_Ranked.mp3 | Derrota ranked |

## Flujo de Funcionamiento

### 1. Inicialización (main.tsx)
```
BrowserRouter
  → MusicProvider (detecta ruta inicial)
    → QueryClientProvider
      → ClerkProvider
        → App (rutas)
```

### 2. Cambio de Ruta
- MusicProvider detecta cambio en `location.pathname`
- Busca música en MUSIC_MAP
- Si es diferente a la actual, llama `getMusicManager().playMusic(path)`
- Fade in de 300ms

### 3. En Batalla
- `/battle` + modo casual/ranked → música de batalla correspondiente
- TURN_RESOLVED evento:
  - Extrae moveName del battle log
  - Llama `playMoveSound(moveName, 0.7)`
  - Se reproduce sonido en paralelo a música (volúmenes diferentes)

### 4. Después de Batalla
- `/results/:roomId` se carga
- Compara playerId con winnerUserId
- Llama `setBattleContext(mode, 'victory'|'derrota')`
- MusicProvider detecta cambio de battleResult y cambia música

## Consideraciones de Navegador

### Autoplay Policy
- Navegadores modernos requieren user gesture para autoplay
- `playMoveSound()` ignora errores silenciosamente
- La música de fondo se inicia en primer click/interacción

### Rutas Públicas vs Relativas
- Todos los paths usan `/` como prefijo (ej: `/sonidos/Music/...`)
- Vite resuelve rutas relativas a la carpeta raíz (`public/` + archivos en `sonidos/`)
- En build de producción, los archivos deben estar en `dist/sonidos/`

### Volúmenes
- Música de fondo: **0.3** (30%)
- Sonidos de ataque: **0.7** (70%)
- No interfieren entre sí (HTML Audio elements separados)

## Testing Manual

1. Navegar a `/` - Debe reproducir `Musica_Titulo.mp3`
2. Navegar a `/home` - Debe fade out/in a `Musica_Home.mp3`
3. Navegar a `/pokedex` - Debe cambiar a `Musica_Pokedex.mp3`
4. Navegar a `/battle/:roomId` - Música de batalla (según modo)
5. Durante batalla, al ver "Pikachu used Thunderbolt!" - Debe reproducir `Thunderbolt.mp3`
6. Navegar a `/results/:roomId` - Música de victoria/derrota (según resultado)

## Archivos de Audio Disponibles

**Música (13 archivos en `sonidos/Music/`):**
- Musica_Titulo.mp3
- Musica_Home.mp3
- Musica_Lobby.mp3
- Musica_Pokedex.mp3
- Batalla_Casual.mp3
- Batalla_Ranked.mp3
- Batalla_Premium1.mp3, ...Premium3.mp3 (futura función premium)
- Victoria_Casual.mp3
- Victoria_Ranked.mp3
- Derrota_Casual.mp3
- Derrota_Ranked.mp3

**Sonidos de Movimientos (619 archivos en `sonidos/Attack Moves/`):**
- Thunderbolt.mp3, Flamethrower.mp3, etc.
- Nombres con espacios manejados correctamente (ej: "Air Slash.mp3")

## Próximos Pasos (Fase 6)

- Battle Screen UI + animaciones
- Posible mejora: precargar lista de movimientos disponibles
- Posible mejora: gestor de volumen independiente (música vs efectos)
- Posible mejora: música de tienda/premium cuando esté implementado

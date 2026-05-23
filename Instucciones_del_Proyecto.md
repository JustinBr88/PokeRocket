# Proyecto Individual: Pokémon Battle Rooms

**Asignación:** Pokémon Battle Rooms  
**Curso:** Desarrollo de Software  
**Modalidad:** Individual  
**Duración:** 1 semana  
**Entrega:** Demo corta en clase  
**Docente:** Erick Vicente Agrazal Lopez

## 1. Resumen para Microsoft Teams

Desarrollar una aplicación web de batallas Pokémon **1P vs 1P** mediante salas con código, usando datos importados desde **PokéAPI** y persistidos en **MongoDB**. El sistema debe permitir crear partidas, unir dos jugadores, seleccionar equipos, resolver turnos de combate y aplicar reglas básicas de daño, tipos, estados y victoria.

### Instrucciones principales

- El proyecto es **individual** y debe completarse en **1 semana**.
- Stack obligatorio: **TanStack Start**, **Bun**, **Hono**, **MongoDB** y **Docker / Docker Compose**.
- Cargar **al menos 300 Pokémon** desde PokéAPI. La data **no debe estar hardcodeada**.
- Cada Pokémon en batalla debe tener **exactamente 4 movimientos** válidos obtenidos desde PokéAPI.
- Implementar salas: un jugador crea la sala, el sistema genera un código y el segundo jugador se une usando ese código.
- Batalla **1P vs 1P**. Cada jugador con equipo de hasta **6 Pokémon** y un Pokémon activo.
- El **backend** debe validar acciones y resolver el turno. El frontend solo envía decisiones.
- Aplicar daño considerando: poder, tipo, stats, STAB, efectividad por tipo, factor aleatorio y golpe crítico.
- Vulnerabilidades, resistencias e inmunidades por tipo deben obtenerse desde PokéAPI.
- Estados temporales duran **3 turnos**. Se eliminan al cambiar de Pokémon.
- Usar **sprites consistentes** (no mezclar 2D con 3D).
- Incluir **animaciones básicas** (ataques, daño, cambios, barras de vida, debilitamiento).

## 2. Objetivos Específicos

- Modelar Pokémon, movimientos, tipos, jugadores, salas, turnos y estado de batalla.
- Importar al menos 300 Pokémon desde PokéAPI y persistirlos en MongoDB.
- Implementar sala 1P vs 1P con código compartido.
- Resolver turnos de batalla **desde el backend**.
- Aplicar reglas de efectividad entre tipos usando data de PokéAPI.
- Mostrar interfaz clara con sprites, barras de vida, acciones y log de batalla.

## 3. Fuente de Datos Obligatoria: PokéAPI

Endpoints principales:

| Uso                        | Endpoint |
|---------------------------|----------|
| Lista paginada de Pokémon | `GET https://pokeapi.co/api/v2/pokemon?limit=300&offset=0` |
| Detalle de Pokémon        | `GET https://pokeapi.co/api/v2/pokemon/{id-or-name}/` |
| Detalle de movimiento     | `GET https://pokeapi.co/api/v2/move/{id-or-name}/` |
| Relaciones de daño por tipo | `GET https://pokeapi.co/api/v2/type/{id-or-name}/` |

**Requisitos mínimos de carga:**
- Al menos 300 Pokémon.
- Guardar: id, nombre, tipos, estadísticas base, sprite y movimientos.
- Guardar movimientos con nombre, tipo, poder, precisión, prioridad, categoría y efectos.
- Guardar relaciones de daño entre tipos.
- Documentar el proceso de importación en el README.

## 4. Requisitos Funcionales Obligatorios

### 1. Catálogo de Pokémon
- Mínimo 300 Pokémon.
- Cada uno con nombre, sprite, tipos, vida, stats y **exactamente 4 movimientos**.
- Sprites consistentes con el estilo del UI.

### 2. Movimientos
- Cada Pokémon en batalla debe tener **exactamente 4 movimientos** (no repetidos).
- Los movimientos deben provenir de los disponibles en PokéAPI.

### 3. Sistema de Salas
- Crear sala → generar código único.
- Unirse con código.
- Lobby de espera.
- Iniciar partida cuando ambos jugadores estén listos.
- No requiere login (nombres temporales).

### 4. Formato de Batalla
- 1 vs 1.
- Equipo de hasta 6 Pokémon por jugador.
- Un Pokémon activo por jugador.
- Victoria al debilitar todos los Pokémon del rival.

### 5. Turnos y Acciones
- Cada turno: usar movimiento o cambiar Pokémon.
- **Todas las validaciones y cálculo de daño en el backend**.
- Frontend solo envía decisiones.

### 6. Orden de Acciones (Mínimo)
- Coin flip para decidir quién va primero (mejora opcional: prioridad + velocidad).

### 7. Daño y Tipos
- Cálculo completo en backend.
- Efectividad por tipo desde PokéAPI (x2, x0.5, x0, x1).
- Log debe indicar súper efectivo / poco efectivo / sin efecto.

### 8. Estados Temporales
- Duración: **3 turnos**.
- Se eliminan al cambiar de Pokémon.
- Ejemplos: parálisis, veneno, quemadura, reducciones de stats.

### 9. Interfaz y Animaciones
- Pantallas: crear sala, unirse, lobby, batalla.
- Batalla: sprites, barras de vida, 4 botones de movimientos, opción de cambio.
- Log de batalla.
- Animaciones básicas.

## 5. Fórmulas Sugeridas para el Motor de Batalla

### Stats (Nivel 50)
```python
level = 50
iv = randomInt(0, 31)
hp = floor(((2 * baseHp + iv) * level) / 100) + level + 10
stat = floor(((2 * baseStat + iv) * level) / 100) + 5
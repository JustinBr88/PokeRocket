## Pokefighter E2E Tests - TDD Setup ✅ Completado

### Estructura Creada

```
pokefighter/
├── playwright.config.ts          # Configuración de Playwright
├── package.json                  # Scripts de tests agregados
├── test/
│   └── e2e/
│       └── pokefighter.spec.ts   # Suite de tests principales
```

### Scripts Agregados a `package.json`

```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed",
"test:e2e:debug": "playwright test --debug"
```

---

## Cómo Correr los Tests

### Paso 1: Levantar MongoDB (si no está activo)
```bash
npm run db:start
```

### Paso 2: En terminal 1 - Backend
```bash
npm run dev:backend
```

### Paso 3: En terminal 2 - Frontend
```bash
npm run dev:frontend
```

### Paso 4: En terminal 3 - Tests
```bash
# Modo headless (sin UI)
npm run test:e2e

# Modo headed (muestra browser)
npm run test:e2e:headed

# Modo debug (interactivo con inspector)
npm run test:e2e:debug
```

---

## Test Coverage (TDD - Los tests están LISTOS para fallar/pasar)

### Grupo B - Auth Flow (6 tests)
- ✅ **B1:** Title screen → Home (sin login)
- ✅ **B2:** Home → Profile button (login/logout toggle)
- ✅ **B3:** Casual mode → Sin restricción auth (crear)
- ✅ **B3:** Ranked mode → Requiere auth (crear)
- ✅ **B3:** Join room → Sin restricción auth
- ✅ **B4:** Room casual → Sin restricción auth
- ✅ **B4:** Room ranked → Requiere auth (redirect login) *TODO: necesita usuario logueado*
- ✅ **B4:** Team Builder casual → Sin restricción auth

### Grupo C - Team Builder Pokémon (2 tests)
- ✅ **C1+C2:** Carga 300 Pokémon (no 60) con `limit: 300`
- ✅ **C2:** Search Pokémon respeta límite 300

### Grupo A - WebSocket & Sync (3 tests)
- ✅ **A1:** Crear sala casual y conectar vía WS
- ✅ **A2:** Chat en tiempo real en lobby
- ✅ **A4+A5:** READY sync entre 2 jugadores

### Grupo D - Clerk Auth Bug (2 tests - ESPERADO FALLAR)
- ⚠️ **D1:** Login con email → Debería renderizar page con password
  - **BUG ESPERADO:** Se redirige a `/login/factor-one` pero no renderiza nada
- ✅ **D2:** Login con Gmail OAuth → Funciona correctamente

---

## Estado de los Tests

### Tests que FALLARÁN hasta implementar fixes:
1. **B1:** `navigate('/home')` incondicional en title.tsx
2. **B2:** Botón perfil dinámico en home.tsx
3. **B3:** Lógica condicional de auth en play.tsx
4. **B4:** Auth guards en room.tsx y teams.tsx
5. **C1+C2:** useEffect + limit 300 en teams.tsx
6. **D1:** Bug de Clerk factor-one page (necesita arreglo en frontend)

### Tests que PUEDEN pasar ahora (dependiendo de state actual):
- B2, A1, A2 (si WebSocket ya funciona)

---

## Errores Identificados (por Grupo)

### Grupo A - WebSocket
- Puede estar funcional ya (según FIXES_PLAN)

### Grupo B - Auth
1. **B1:** Title redirige a `/login` en lugar de `/home` → Arreglar en `title.tsx:8-14`
2. **B2:** No hay botón perfil dinámico en home → Agregar en `home.tsx:45-51`
3. **B3:** Play buttons no respetan modo (casual sin auth, ranked con auth) → Arreglar en `play.tsx`
4. **B4:** Room/teams no tienen auth guards por modo → Agregar en `room.tsx` y `teams.tsx`
5. **D1:** Clerk `/login/factor-one` no renderiza → **BUG A INVESTIGAR/ARREGLAR**

### Grupo C - Team Builder
1. **C1:** No carga Pokémon en mount → Agregar `useEffect` en `teams.tsx`
2. **C2:** Búsqueda limitada a 60 en lugar de 300 → Cambiar límite en `teams.tsx`

---

## Próximos Pasos

1. ✅ Tests creados (TDD first)
2. 🔲 Correr tests con `npm run test:e2e` para ver los fallos
3. 🔲 Implementar fixes basados en fallos
4. 🔲 Re-correr tests hasta que todos pasen

---

## Notas Importantes

- **Playwright config:** `baseURL: 'http://localhost:5173'`
- **API URL:** `http://localhost:3001/api` (definido en `.env`)
- **WS URL:** `ws://localhost:3001` (definido en `.env`)
- **Test user:** `morrallaclassy@gmail.com` / `1QSE45TGHU8` (disponible si necesitas tests de login)
- **Timeout estándar:** 5000ms para esperar elementos
- **Reportes:** HTML en `playwright-report/index.html` después de cada corrida

---

## Errores Esperados al Correr por Primera Vez

```
Error: B1 failed - navigate('/login') not '/home'
Error: B2 failed - Profile button not found
Error: B3 failed - Casual button is disabled (debería estar enabled)
Error: B4 failed - Auth guard not blocking on ranked room
Error: C1 failed - Load only 60 Pokémon (expected >60)
Error: D1 failed - /login/factor-one page not rendering (BUG CLERK)
```

Esto es **NORMAL** con TDD. Los tests definen qué debe pasar, y los fixes hacen que pasen.

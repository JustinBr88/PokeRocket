# 🎮 POKEFIGHTER - ESTADO ACTUAL DEL PROYECTO

**Fecha:** Mayo 20, 2026  
**Fase Actual:** 7-9 (Premium System)  
**Estado:** 🟡 EN IMPLEMENTACIÓN (Paralelo)

---

## 📊 RESUMEN DE FASES

| Fase | Nombre | Estado | Descripción |
|------|--------|--------|-------------|
| **0** | Scaffold + Setup | ✅ Completada | Backend (Bun+Hono+Mongoose), Frontend (Vite+React) |
| **1** | UI Screens | ✅ Completada | Home, Play, Room, Teams, Battle, Results, etc. |
| **2** | PokéAPI Import | ✅ Completada | 300 Pokémon + moves + tipos |
| **3** | Sistema de Roles | ✅ Completada | 12 ataques seleccionables por Pokémon |
| **4** | Lobby Real-Time | ✅ Completada | Chat WS + READY sync + reconnect |
| **5** | Música + Sonidos | ✅ Completada | Música por pantalla + sonidos de ataques |
| **6** | Battle UI | ✅ Completada | Pantalla de batalla + animaciones |
| **7** | 💎 Premium: Stripe | ✅ Completada | Pago $14.99 + UI Premium + Sidebar button |
| **8** | 💎 Shiny Toggle | ⏳ En Progreso | Toggle normal/shiny en Pokédex (Premium) |
| **9** | 💎 Música Premium | ⏳ En Progreso | 3 canciones random si Premium en batalla |
| **10** | Draft Mode | 🔲 Pendiente | Ranked: bans + picks |
| **11** | Post-Draft | 🔲 Pendiente | Elegir moves/ability |
| **12** | Battle History | 🔲 Pendiente | Results + historial |
| **13** | Ranked ELO | 🔲 Pendiente | Leaderboards |

---

## 💎 SISTEMA PREMIUM - ESPECIFICACIONES

### Precio y Modelo
- **Costo:** $14.99 USD (Pago único, no suscripción)
- **Características Incluidas:**
  1. Sprites Shiny seleccionables por Pokémon en Pokédex
  2. 3 Canciones de Batalla Premium (selección random si 1+ jugador es Premium)

### Acceso
- **Botón:** Visible en sidebar de `/home` entre "Rules" y "SEARCH BATTLE"
- **Estado:** 
  - Sin Premium: "PREMIUM" (texto normal)
  - Con Premium: "PREMIUM (Active)" (fondo tertiary-fixed)
- **Flujo:** Click → `/premium` → Formulario Stripe → Pago → isPremium = true

### Claves de Prueba (Test Mode)
```
Pública:  pk_test_51TZK21FMKxi9pJErIvJQwsO1GbNDD7ZLLnia9rnvIcRUiMLx6eV5CGbig8erAAJgOV6gTJgHmi1jd6mGpz0qotY000KiA6MWDz
Secreta:  sk_test_51TZK21FMKxi9pJErEfjWYWZcvY07t9YFlz3EhMp3GvTVi3r06BinSPVWmKThS9GUVjbLA66rLJwwwDKGlN0pnvva00FsRuLDiN
Webhook:  whsec_f7ju0ODKgl0W5nlH0RTlthxrmxlDxuhv

Tarjetas de prueba:
✅ Éxito:    4242 4242 4242 4242 (CVC: cualquiera, exp: futuro)
❌ Rechazo: 4000 0000 0000 0002
```

---

## 📁 ARQUITECTURA DEL PROYECTO

```
pokefighter/
├── backend/ (Bun + Hono)
│   ├── src/
│   │   ├── index.ts               # App principal + WS upgrade
│   │   ├── db.ts                  # MongoDB connection
│   │   ├── models/index.ts        # Mongoose schemas (9 modelos)
│   │   ├── routes/
│   │   │   ├── auth.ts            # Clerk webhook
│   │   │   ├── rooms.ts           # CRUD salas
│   │   │   ├── battle.ts          # Battle engine + WS
│   │   │   ├── teams.ts           # Team builder
│   │   │   ├── pokemon.ts         # Search + Sprite (SHINY)
│   │   │   ├── payments.ts        # Stripe intents (PREMIUM)
│   │   │   ├── movesets.ts        # Get movesets
│   │   │   └── stripeWebhook.ts   # Webhook listener (PREMIUM)
│   │   ├── services/
│   │   │   ├── battleEngine.ts    # Damage calc + selectBattleMusic() (MÚSICA)
│   │   │   ├── moveSelector.ts    # Select 12 moves
│   │   │   ├── roleDetection.ts   # Detect role
│   │   │   └── stripeService.ts   # Stripe SDK wrapper (PREMIUM)
│   │   ├── ws/
│   │   │   ├── handler.ts         # WS lifecycle
│   │   │   └── roomRegistry.ts    # Room map + broadcast
│   │   └── scripts/
│   │       ├── importFromPokeAPI.ts
│   │       └── generate_movesets.ts
│   ├── package.json               # Deps + scripts
│   └── .env                       # Secrets + config
│
├── frontend/ (Vite + React)
│   ├── src/
│   │   ├── main.tsx               # Entry + Providers
│   │   ├── App.tsx                # Routes + layout
│   │   ├── app/
│   │   │   ├── index.css          # Design tokens + animations
│   │   │   └── routes/
│   │   │       ├── title.tsx
│   │   │       ├── login.tsx
│   │   │       ├── home.tsx       # Sidebar + Premium button
│   │   │       ├── pokedex.tsx    # Grid + Shiny toggle (SHINY)
│   │   │       ├── teams.tsx      # Team builder
│   │   │       ├── battle.tsx     # Battle screen
│   │   │       ├── premium.tsx    # Stripe page (PREMIUM)
│   │   │       ├── results.tsx
│   │   │       ├── leaderboards.tsx
│   │   │       ├── history.tsx
│   │   │       ├── rules.tsx
│   │   │       ├── room.tsx
│   │   │       └── play.tsx
│   │   ├── components/
│   │   │   └── MusicProvider.tsx  # Music routing + premium selection (MÚSICA)
│   │   ├── lib/
│   │   │   ├── sprites.ts         # API_URL + WS_URL + sprite helpers
│   │   │   ├── poke-api.ts        # Fetch functions
│   │   │   ├── useBattleSocket.ts # WS hook
│   │   │   └── musicManager.ts    # Music player singleton
│   │   ├── stores/
│   │   │   ├── teamStore.ts       # Zustand: team + shinyEnabled (SHINY)
│   │   │   ├── musicStore.ts      # Zustand: music state
│   │   │   └── playerImageStore.ts
│   │   ├── types/index.ts         # WsMessage + BattleState (tipos extendidos)
│   │   └── .env                   # API_URL + WS_URL + Stripe key
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── sonidos/
│   ├── Music/
│   │   ├── Musica_Titulo.mp3
│   │   ├── Musica_Home.mp3
│   │   ├── Musica_Lobby.mp3
│   │   ├── Musica_Pokedex.mp3
│   │   ├── Batalla_Casual.mp3
│   │   ├── Batalla_Ranked.mp3
│   │   ├── Batalla_Premium1.mp3   (NEW)
│   │   ├── Batalla_Premium2.mp3   (NEW)
│   │   ├── Batalla_Premium3.mp3   (NEW)
│   │   ├── Victoria_Casual.mp3
│   │   ├── Derrota_Casual.mp3
│   │   ├── Victoria_Ranked.mp3
│   │   └── Derrota_Ranked.mp3
│   └── Attack Moves/ (619 archivos)
│
├── AGENTS.md                      # Estado del proyecto (actualizado)
├── PREMIUM_IMPLEMENTATION.md      # Guía de implementación Premium (nuevo)
├── docker-compose.yml             # MongoDB
├── package.json                   # Scripts raíz
└── .env.example
```

---

## 🔄 FLUJOS PRINCIPALES

### 1️⃣ Flujo de Compra Premium
```
Home (/home)
  ↓
Click "PREMIUM" button (sidebar)
  ↓
Navega a /premium
  ↓
¿Autenticado? → No → Redirige a /login
  ↓
¿Ya Premium? → Sí → Muestra "YA TIENES PREMIUM!"
  ↓
NO → Muestra formulario Stripe (CardElement)
  ↓
User ingresa tarjeta + Click "PAGAR $14.99"
  ↓
Frontend POST /api/payments/intent (crear PaymentIntent)
  ↓
stripe.confirmCardPayment(clientSecret)
  ↓
Frontend POST /api/payments/confirm
  ↓
Backend verifica y actualiza User { isPremium: true }
  ↓
Webhook Stripe confirma pago
  ↓
User redirigido a /home (botón ahora dice "PREMIUM (Active)")
```

### 2️⃣ Flujo Shiny Toggle (FASE 8)
```
Pokédex (/pokedex)
  ↓
Ver grid de 300 Pokémon
  ↓
Click en uno → Abre panel lateral
  ↓
¿isPremium? → Sí → Muestra botón "⭕ NORMAL SPRITE"
  ↓
User click → Cambia a "✨ SHINY SPRITE"
  ↓
teamStore.toggleShiny(pokemonId) → shinyEnabled: true
  ↓
Sprite grande cambia a PNG shiny (PokeAPI)
  ↓
User agrega al team (Team Builder)
  ↓
Team guardado con { shinyEnabled: true } en DB
  ↓
En batalla: sprite muestra versión shiny
```

### 3️⃣ Flujo Música Premium (FASE 9)
```
Lobby (/room/:roomId)
  ↓
Player A (sin Premium) vs Player B (con Premium)
  ↓
Ambos READY → Backend verifica isPremium
  ↓
hasAnyPremium = true (porque Player B tiene Premium)
  ↓
selectBattleMusic('casual', true) → random [Premium1, 2 o 3]
  ↓
BATTLE_STARTED WS con { selectedBattleMusic: "Batalla_Premium2.mp3" }
  ↓
Frontend recibe → MusicProvider escucha
  ↓
musicManager.playMusic(selectedBattleMusic)
  ↓
Música premium suena durante batalla
  ↓
Batalla termina → Música de resultados (normal)
```

---

## 🧪 TESTING LOCAL

### Setup
```bash
# Terminal 1: Backend
cd backend
bun install    # Si es primera vez
bun run dev    # Comienza en puerto 3001

# Terminal 2: Frontend (en paralelo o después)
cd frontend
bun install    # Si es primera vez
bun run dev    # Comienza en puerto 5173

# Terminal 3: MongoDB (si no está en Docker)
docker compose up -d mongo

# Dashboard: http://localhost:5173
# API: http://localhost:3001/api
```

### Testing Premium (Stripe Test Mode)
1. **Login** con Clerk (crear cuenta de test)
2. **Click "PREMIUM"** en sidebar
3. **Ingresa tarjeta test:** `4242 4242 4242 4242`
4. **CVC:** cualquiera (ej: 123)
5. **Exp:** futuro (ej: 12/26)
6. **Click "PAGAR $14.99"**
7. ✅ Si success: redirige a /home + botón dice "PREMIUM (Active)"

### Testing Shiny (FASE 8)
1. Con Premium activado: Navega a `/pokedex`
2. Click en cualquier Pokémon
3. Debería ver botón "⭕ NORMAL SPRITE"
4. Click → Cambia a "✨ SHINY SPRITE"
5. Sprite grande debe cambiar a PNG (static, diferente de animado)
6. Agregar al team → Team Builder
7. Guardar team
8. Iniciar batalla → Sprite debe mostrar versión shiny

### Testing Música Premium (FASE 9)
1. Abrir DevTools (F12)
2. Console → Buscar `[BATTLE]` logs
3. Debería ver: `[BATTLE] Selected premium track: sonidos/Music/Batalla_Premium2.mp3` (ejemplo)
4. Iniciar batalla con 1+ Premium
5. Audio debe reproducir canción premium (diferente a normal)

---

## 📋 ENDPOINTS CREADOS (PREMIUM)

### Payment Endpoints
```
POST /api/payments/intent
Body: { userId: string }
Response: { clientSecret, paymentIntentId, amount, currency }

POST /api/payments/confirm
Body: { userId: string, paymentIntentId: string }
Response: { ok: true, message: string, user: UserObject }

GET /api/payments/check-premium/:userId
Response: { isPremium: boolean, premiumPurchasedAt: Date }

POST /api/stripe-webhook
Headers: stripe-signature
Body: raw JSON (webhook event)
Response: { ok: true }
```

### Pokemon Endpoints (SHINY - FASE 8)
```
GET /api/pokemon/sprite/:pokedexId?shiny=true
Response: { spriteUrl: string, isShiny: boolean }
```

### Battle Endpoints (MÚSICA - FASE 9)
```
WebSocket: BATTLE_STARTED event incluye selectedBattleMusic
{
  type: 'BATTLE_STARTED',
  battle: BattleState,
  premiumInfo: { player1HasPremium, player2HasPremium },
  selectedBattleMusic: string // ← NUEVO
}
```

---

## 📚 DOCUMENTACIÓN

| Archivo | Contenido |
|---------|-----------|
| `AGENTS.md` | Estado del proyecto + Tech Stack |
| `PREMIUM_IMPLEMENTATION.md` | Guía completa de implementación (Fase 7-9) |
| `DESIGN.md` | Sistema de diseño (colores, tipografía, componentes) |
| `Instucciones_del_Proyecto.md` | Requisitos del curso |

---

## 🎯 PRÓXIMOS PASOS

### Inmediatos (Mientras esperan FASE 8-9)
- [ ] Verificar que `npm install` en backend instaló `stripe@14.25.0`
- [ ] Verificar que `npm install` en frontend instaló `@stripe/react-stripe-js@2.9.0`
- [ ] Probar flujo Premium completo con tarjeta test
- [ ] Verificar que el botón Premium aparece en sidebar

### Corto Plazo (Después FASE 8-9)
- [ ] Testing Shiny: toggle en Pokédex → batalla muestra versión shiny
- [ ] Testing Música: verificar WS logs muestran música premium seleccionada
- [ ] QA: probar combos (1 Premium + 1 sin Premium debe usar música premium)

### Mediano Plazo (Fase 10+)
- [ ] Draft Mode: bans + picks en ranked
- [ ] Post-Draft: elegir moves/ability
- [ ] Battle History: guardar resultados reales
- [ ] Ranked ELO: sistema de puntos + leaderboards

---

## 🔐 SEGURIDAD

**Stripe Test Mode:**
- ✅ Claves de test (no producción)
- ✅ Webhook signature verification implementado
- ✅ Metadatos de pago incluyen userId (linkeo)
- ✅ isPremium guardado en BD (persistencia)

**Authentication:**
- ✅ Clerk manejando auth (SSO + webhooks)
- ✅ User sincronizado en DB vía webhook
- ✅ Endpoints de pago validan userId contra Clerk

**Data:**
- ✅ Shiny preference guardada en Team (persistencia)
- ✅ Premium status en User (caché local en Clerk)
- ✅ Música seleccionada temporalmente (no persistida)

---

## 📊 ESTADO ACTUAL DE DELEGACIONES

```
✅ FASE 7: Setup Stripe + Premium UI (COMPLETADA)
⏳ FASE 8: Shiny Toggle (EN PROGRESO - sensible-aqua-turkey)
⏳ FASE 9: Música Premium (EN PROGRESO - historic-moccasin-shark)
```

**Tiempo estimado:** 15-20 minutos para ambas fases

---

## 💬 NOTAS IMPORTANTES

- ❌ **NO ejecutar `npm run build`** después de cambios
- ❌ **NO usar en producción** — solo test mode
- ✅ **`bun install` completado** en ambos lados
- ✅ **Todas las variables .env configuradas**
- 📍 **Port backend:** 3001
- 📍 **Port frontend:** 5173
- 📍 **MongoDB:** localhost:27017 (docker-compose.yml)

---

**Generado:** 2026-05-20  
**Versión:** 1.1 (Fase 7-9 en progreso)

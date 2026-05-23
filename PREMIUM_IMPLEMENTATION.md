# 💎 PREMIUM IMPLEMENTATION PLAN

## Resumen Ejecutivo

**Objetivo:** Implementar sistema de pago Stripe ($14.99 one-time) para desbloquear:
1. Sprites Shiny en Pokédex (seleccionables por Pokémon)
2. Música de Batalla Premium (3 canciones random si un jugador tiene Premium)

**Estado:** Fase 7 en desarrollo, Fase 8-9 planificadas

**Claves Stripe (Test):**
- **Pública:** `pk_test_51TZK21FMKxi9pJErIvJQwsO1GbNDD7ZLLnia9rnvIcRUiMLx6eV5CGbig8erAAJgOV6gTJgHmi1jd6mGpz0qotY000KiA6MWDz`
- **Secreta:** `sk_test_51TZK21FMKxi9pJErEfjWYWZcvY07t9YFlz3EhMp3GvTVi3r06BinSPVWmKThS9GUVjbLA66rLJwwwDKGlN0pnvva00FsRuLDiN`
- **Webhook Secret:** `whsec_f7ju0ODKgl0W5nlH0RTlthxrmxlDxuhv`

---

## 🔷 FASE 7: SETUP STRIPE + PÁGINA DE PAGO

### 7.1: Backend Setup Stripe

**Instalar SDK:**
```bash
cd backend
bun add stripe
```

**Crear `backend/src/services/stripeService.ts`:**

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export { stripe };

/**
 * Crear un PaymentIntent para el cliente
 * El cliente luego completa el pago en frontend con Stripe Elements
 */
export async function createPaymentIntent(
  userId: string,
  email: string,
  amount: number = parseInt(process.env.PREMIUM_PRICE || '1499')
) {
  return await stripe.paymentIntents.create({
    amount, // centavos
    currency: 'usd',
    metadata: { userId, email },
    description: `PokéFighter Premium - User ${userId}`,
  });
}

/**
 * Confirmar un PaymentIntent (ya realizado en cliente, pero validar en backend)
 */
export async function confirmPaymentIntent(paymentIntentId: string) {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Crear un customer en Stripe (opcional, pero bueno para historial)
 */
export async function createStripeCustomer(email: string, userId: string) {
  return await stripe.customers.create({
    email,
    metadata: { userId },
    description: `PokéFighter User - ${userId}`,
  });
}
```

**Variables de entorno (`backend/.env`):**
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_51TZK21FMKxi9pJErEfjWYWZcvY07t9YFlz3EhMp3GvTVi3r06BinSPVWmKThS9GUVjbLA66rLJwwwDKGlN0pnvva00FsRuLDiN
STRIPE_PUBLISHABLE_KEY=pk_test_51TZK21FMKxi9pJErIvJQwsO1GbNDD7ZLLnia9rnvIcRUiMLx6eV5CGbig8erAAJgOV6gTJgHmi1jd6mGpz0qotY000KiA6MWDz
STRIPE_WEBHOOK_SECRET=whsec_f7ju0ODKgl0W5nlH0RTlthxrmxlDxuhv
PREMIUM_PRICE=1499  # en centavos USD ($14.99)
```

---

### 7.2: Extender User Model

**Modificar `backend/src/models/index.ts`:**

```typescript
// User Schema - Agregar campos Premium
const UserSchema = new Schema({
  // ... campos existentes
  odiserId: { type: String, unique: true },
  username: String,
  avatarUrl: String,
  elo: { type: Number, default: 1500 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  
  // ↓ NUEVOS CAMPOS PREMIUM ↓
  isPremium: { type: Boolean, default: false },
  premiumPurchasedAt: Date | null,
  stripeCustomerId: String | null,
  stripePaymentIntentId: String | null,
  
  timestamps: true
});
```

---

### 7.3: Crear Endpoints de Pago

**Crear `backend/src/routes/payments.ts`:**

```typescript
import { Hono } from 'hono';
import { stripe, createPaymentIntent, confirmPaymentIntent } from '../services/stripeService';
import { UserModel } from '../models';
import type { Context } from 'hono';

const payments = new Hono();

/**
 * POST /api/payments/intent
 * Crear un PaymentIntent para que el cliente complete el pago
 * 
 * Body: { userId: string }
 * Response: { clientSecret: string, amount: number, paymentIntentId: string }
 */
payments.post('/intent', async (c: Context) => {
  try {
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: 'userId required' }, 400);

    // Obtener usuario
    const user = await UserModel.findOne({ odiserId: userId });
    if (!user) return c.json({ error: 'User not found' }, 404);

    // Si ya tiene premium, error
    if (user.isPremium) return c.json({ error: 'User already has Premium' }, 400);

    // Crear PaymentIntent
    const paymentIntent = await createPaymentIntent(userId, user._id.toString());

    // Guardar referencia temporal en user
    user.stripePaymentIntentId = paymentIntent.id;
    await user.save();

    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (err: any) {
    console.error('[STRIPE] Error creating payment intent:', err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/payments/confirm
 * Confirmar que el pago fue realizado (llamada desde frontend después de confirmCardPayment)
 * 
 * Body: { userId: string, paymentIntentId: string }
 * Response: { ok: boolean, message: string }
 */
payments.post('/confirm', async (c: Context) => {
  try {
    const { userId, paymentIntentId } = await c.req.json();
    if (!userId || !paymentIntentId) return c.json({ error: 'userId y paymentIntentId required' }, 400);

    // Obtener PaymentIntent desde Stripe
    const paymentIntent = await confirmPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return c.json({ error: 'Payment not completed' }, 400);
    }

    // Actualizar usuario: marcar como Premium
    const user = await UserModel.findOneAndUpdate(
      { odiserId: userId },
      {
        isPremium: true,
        premiumPurchasedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
      { new: true }
    );

    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json({ ok: true, message: 'Premium activated!', user });
  } catch (err: any) {
    console.error('[STRIPE] Error confirming payment:', err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/payments/check-premium/:userId
 * Verificar si un usuario tiene Premium (para frontend)
 */
payments.get('/check-premium/:userId', async (c: Context) => {
  try {
    const { userId } = c.req.param();
    const user = await UserModel.findOne({ odiserId: userId });
    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json({
      isPremium: user.isPremium,
      premiumPurchasedAt: user.premiumPurchasedAt,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { payments };
```

---

### 7.4: Webhook Stripe

**Crear `backend/src/routes/stripeWebhook.ts`:**

```typescript
import { Hono } from 'hono';
import { stripe } from '../services/stripeService';
import { UserModel } from '../models';
import type { Context } from 'hono';

const stripeWebhook = new Hono();

/**
 * POST /api/stripe-webhook
 * Webhook que Stripe llama cuando ocurren eventos de pago
 * 
 * Headers: stripe-signature (verificación de Stripe)
 * Body: raw JSON (Buffer)
 */
stripeWebhook.post('/', async (c: Context) => {
  try {
    // Obtener firma y body raw
    const sig = c.req.header('stripe-signature');
    const body = await c.req.text();

    if (!sig) {
      console.error('[STRIPE-WEBHOOK] Missing stripe-signature header');
      return c.json({ error: 'Missing signature' }, 400);
    }

    // Verificar que la petición viene realmente de Stripe
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('[STRIPE-WEBHOOK] Signature verification failed:', err.message);
      return c.json({ error: 'Signature verification failed' }, 403);
    }

    // Procesar eventos
    console.log(`[STRIPE-WEBHOOK] Event type: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;

      // Buscar usuario por metadata.userId
      const userId = paymentIntent.metadata?.userId;
      if (!userId) {
        console.warn('[STRIPE-WEBHOOK] No userId in metadata', paymentIntent.id);
        return c.json({ ok: false });
      }

      // Marcar usuario como Premium
      const user = await UserModel.findOneAndUpdate(
        { odiserId: userId },
        {
          isPremium: true,
          premiumPurchasedAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        },
        { new: true }
      );

      if (user) {
        console.log(`[STRIPE-WEBHOOK] Premium activated for user ${userId}`);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any;
      console.warn(`[STRIPE-WEBHOOK] Payment failed: ${paymentIntent.id}`);
      // Opcional: notificar usuario que falló el pago
    }

    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[STRIPE-WEBHOOK] Unexpected error:', err);
    return c.json({ error: err.message }, 500);
  }
});

export { stripeWebhook };
```

**Registrar en `backend/src/index.ts`:**

```typescript
import { stripeWebhook } from './routes/stripeWebhook';
import { payments } from './routes/payments';

// ... después de crear app ...

app.route('/api/stripe-webhook', stripeWebhook);
app.route('/api/payments', payments);
```

---

### 7.5: Frontend - Instalar Stripe

**Actualizar `frontend/package.json`:**

```json
{
  "dependencies": {
    "@stripe/react-stripe-js": "^2.4.0",
    "@stripe/stripe-js": "^3.0.0"
  }
}
```

```bash
cd frontend
bun add @stripe/react-stripe-js @stripe/stripe-js
```

---

### 7.6: Variables de Entorno Frontend

**`frontend/.env`:**
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51TZK21FMKxi9pJErIvJQwsO1GbNDD7ZLLnia9rnvIcRUiMLx6eV5CGbig8erAAJgOV6gTJgHmi1jd6mGpz0qotY000KiA6MWDz
```

---

### 7.7: Premium Page Component

**Crear `frontend/src/app/routes/premium.tsx`:**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMutation } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder'
);

export default function PremiumPage() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      navigate('/login');
      return;
    }

    // Verificar si ya tiene Premium
    if (user?.id) {
      fetch(`${API_URL}/payments/check-premium/${user.id}`)
        .then(r => r.json())
        .then(data => {
          setIsPremium(data.isPremium);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error checking premium:', err);
          setLoading(false);
        });
    }
  }, [isSignedIn, user?.id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-body-lg text-on-surface">Cargando...</div>
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="min-h-screen bg-background font-body flex flex-col">
        <div className="crt-overlay" />
        
        <header className="bg-surface-container-lowest border-b-3 border-black p-4 sticky top-0 z-50">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
            aria-label="Volver a home"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">
            PREMIUM
          </h1>
        </header>

        <main className="flex-1 p-4 flex items-center justify-center">
          <div className="max-w-md bg-surface-container border-4 border-black p-6 text-center">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="font-headline text-headline-md text-primary mb-2 uppercase">
              YA TIENES PREMIUM!
            </h2>
            <p className="text-body-md text-on-surface-variant mb-6">
              Disfruta de sprites shiny en tu Pokédex y canciones de batalla exclusivas.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="w-full bg-primary text-on-primary font-headline uppercase px-4 py-3 border-3 border-black hover:bg-primary-container transition"
            >
              Volver a HOME
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PremiumCheckout />
    </Elements>
  );
}

function PremiumCheckout() {
  const navigate = useNavigate();
  const { user } = useUser();
  const stripe = useStripe();
  const elements = useElements();

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/payments/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create payment intent');
      }
      return res.json();
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const res = await fetch(`${API_URL}/payments/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          paymentIntentId,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Payment confirmation failed');
      }
      return res.json();
    },
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    try {
      // Paso 1: Crear intent en backend
      const intentData = await createIntentMutation.mutateAsync();

      // Paso 2: Confirmar pago en frontend con Stripe
      const { paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              email: user?.primaryEmailAddress?.emailAddress,
            },
          },
        }
      );

      if (paymentIntent?.status === 'succeeded') {
        // Paso 3: Confirmar en backend
        await confirmPaymentMutation.mutateAsync(paymentIntent.id);
        alert('¡Pago exitoso! Premium activado.');
        navigate('/home');
      } else {
        alert('El pago no se completó. Intenta nuevamente.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      alert(`Error en el pago: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body flex flex-col">
      <div className="crt-overlay" />
      
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 sticky top-0 z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
          aria-label="Volver a home"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">
          UPGRADE TO PREMIUM
        </h1>
      </header>

      <main className="flex-1 p-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-surface-container border-4 border-black p-6">
          {/* Features */}
          <div className="mb-6">
            <h2 className="font-headline text-headline-md text-primary mb-4 uppercase">
              QUÉ INCLUYE PREMIUM
            </h2>
            <ul className="space-y-3 text-body-md">
              <li className="flex gap-3">
                <span className="text-primary text-lg">✓</span>
                <span>Sprites Shiny en Pokédex</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary text-lg">✓</span>
                <span>3 Canciones de Batalla Exclusivas</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary text-lg">✓</span>
                <span>Acceso de por vida (sin suscripción)</span>
              </li>
            </ul>
          </div>

          {/* Precio */}
          <div className="bg-surface-container-lowest border-3 border-black p-4 mb-6 text-center">
            <div className="font-headline text-headline-lg text-primary">$14.99</div>
            <div className="text-body-sm text-on-surface-variant">Pago único - USD</div>
          </div>

          {/* Formulario Stripe */}
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="border-3 border-black p-3 bg-surface-container-lowest">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '14px',
                      color: '#1F1F1F',
                      '::placeholder': { color: '#757575' },
                    },
                    invalid: {
                      color: '#E53935',
                    },
                  },
                }}
              />
            </div>

            <button
              type="submit"
              disabled={
                !stripe ||
                !elements ||
                createIntentMutation.isPending ||
                confirmPaymentMutation.isPending
              }
              className="w-full bg-primary text-on-primary font-headline uppercase px-4 py-3 border-3 border-black disabled:opacity-50 hover:bg-primary-container transition"
            >
              {createIntentMutation.isPending || confirmPaymentMutation.isPending
                ? 'PROCESANDO...'
                : 'PAGAR $14.99'}
            </button>
          </form>

          <p className="text-body-sm text-on-surface-variant text-center mt-4">
            Pago seguro con Stripe. Tu información está protegida.
          </p>
        </div>
      </main>
    </div>
  );
}
```

---

### 7.8: Actualizar Router Frontend

**Modificar `frontend/src/App.tsx`:**

```tsx
import PremiumPage from './app/routes/premium';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TitlePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/teams/:roomId" element={<TeamsPage />} />
      <Route path="/battle/:roomId" element={<BattlePage />} />
      <Route path="/results/:roomId" element={<ResultsPage />} />
      <Route path="/leaderboards" element={<LeaderboardsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/pokedex" element={<PokedexPage />} />
      <Route path="/premium" element={<PremiumPage />} />
    </Routes>
  );
}
```

---

### 7.9: Botón Premium en Sidebar

**Modificar `frontend/src/app/routes/home.tsx`:**

Buscar la sección de navigation sidebar y agregar antes del botón SEARCH BATTLE:

```tsx
<nav className="flex flex-col">
  <a
    href="/home"
    className="bg-primary text-on-primary border-l-[6px] border-primary-container p-4 flex items-center gap-3 text-on-surface hover:text-primary transition-colors"
  >
    <span className="material-symbols-outlined">home</span>
    <span>Home</span>
  </a>
  
  <a
    href="/pokedex"
    className="text-on-surface-variant p-4 flex items-center gap-3 hover:text-primary transition-colors"
  >
    <span className="material-symbols-outlined">menu_book</span>
    <span>Pokédex</span>
  </a>
  
  <a
    href="/history"
    className="text-on-surface-variant p-4 flex items-center gap-3 hover:text-primary transition-colors"
  >
    <span className="material-symbols-outlined">inventory_2</span>
    <span>History</span>
  </a>
  
  <a
    href="/rules"
    className="text-on-surface-variant p-4 flex items-center gap-3 hover:text-primary transition-colors"
  >
    <span className="material-symbols-outlined">menu</span>
    <span>Rules</span>
  </a>

  {/* ↓ NUEVO BOTÓN PREMIUM ↓ */}
  <a
    href="/premium"
    className={`p-4 flex items-center gap-3 transition-colors ${
      isPremium
        ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed'
        : 'text-on-surface-variant hover:text-primary'
    }`}
  >
    <span className="material-symbols-outlined">verified_user</span>
    <span className="font-headline">{isPremium ? 'PREMIUM (Active)' : 'PREMIUM'}</span>
  </a>
</nav>
```

**Agregar estado en el componente Home:**

```tsx
const [isPremium, setIsPremium] = useState(false);

useEffect(() => {
  if (user?.id) {
    fetch(`${API_URL}/payments/check-premium/${user.id}`)
      .then(r => r.json())
      .then(data => setIsPremium(data.isPremium))
      .catch(console.error);
  }
}, [user?.id]);
```

---

## 🔶 FASE 8: SHINY TOGGLE EN POKÉDEX + TEAM

### 8.1: Extender Team Model

**Modificar `backend/src/models/index.ts`:**

```typescript
// Team schema - agregar shinyEnabled a cada pokémon
const TeamSchema = new Schema({
  odiserId: String,
  name: String,
  pokemons: [{
    pokemonId: Number,
    ability: String,
    moves: [Number], // exactly 4
    shiny: { type: Boolean, default: false },
    shinyEnabled: { type: Boolean, default: false } // ← NUEVO: toggle usuario
  }],
  timestamps: true
});
```

---

### 8.2: Actualizar Team Store (Zustand)

**Modificar `frontend/src/stores/teamStore.ts`:**

```typescript
interface TeamState {
  currentTeam: {
    pokemonId: number;
    pokemonName: string;
    ability: string;
    moves: string[];
    shiny: boolean;
    shinyEnabled: boolean; // ← NUEVO
  }[];
  
  // ← NUEVA FUNCIÓN
  toggleShiny: (pokemonId: number) => void;
  
  addPokemon: (pokemonId, pokemonName, moves?) => void;
  removePokemon: (index) => void;
  updateMoves: (index, moves) => void;
  updateAbility: (index, ability) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamState>(set => ({
  currentTeam: [],
  
  toggleShiny: (pokemonId: number) =>
    set(state => ({
      currentTeam: state.currentTeam.map(p =>
        p.pokemonId === pokemonId
          ? { ...p, shinyEnabled: !p.shinyEnabled }
          : p
      ),
    })),
  
  addPokemon: (pokemonId, pokemonName, moves) =>
    set(state => ({
      currentTeam: [
        ...state.currentTeam,
        {
          pokemonId,
          pokemonName,
          ability: 'TBD',
          moves: moves || [],
          shiny: false,
          shinyEnabled: false, // ← INICIALIZAR
        },
      ],
    })),

  // ... resto de funciones
}));
```

---

### 8.3: UI Toggle Shiny en Pokédex

**Modificar `frontend/src/app/routes/pokedex.tsx`:**

```tsx
import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTeamStore } from '../stores/teamStore';
import { getFrontSprite } from '../lib/sprites';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export default function PokedexPage() {
  const [selectedPokemon, setSelectedPokemon] = useState<any>(null);
  const { user } = useUser();
  const { currentTeam, toggleShiny } = useTeamStore();

  const isPremium = user?.publicMetadata?.isPremium ?? false;

  // Encontrar si este pokémon está en el team y si tiene shiny enabled
  const teamPokemon = currentTeam.find(
    p => p.pokemonId === selectedPokemon?.pokedexId
  );
  const isShinyEnabled = teamPokemon?.shinyEnabled ?? false;

  if (!selectedPokemon) {
    return (
      <div className="min-h-screen bg-background font-body">
        {/* Grid de Pokémon */}
        {/* ... */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body flex flex-col">
      <div className="crt-overlay" />

      <header className="bg-surface-container-lowest border-b-3 border-black p-4 sticky top-0 z-50 flex items-center gap-4">
        <button
          onClick={() => setSelectedPokemon(null)}
          className="text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase">
          {selectedPokemon.name}
        </h1>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-2xl mx-auto bg-surface-container border-4 border-black p-4">
          {/* Sprite */}
          <div className="w-full h-48 bg-surface-container-lowest border-2 border-black flex items-center justify-center mb-4">
            <img
              src={
                isShinyEnabled && isPremium
                  ? `${API_URL}/pokemon/sprite/${selectedPokemon.pokedexId}?shiny=true`
                  : getFrontSprite(selectedPokemon.name)
              }
              alt={selectedPokemon.name}
              className="image-rendering-pixelated max-w-full max-h-full"
            />
          </div>

          {/* Toggle Shiny Button */}
          {isPremium && (
            <button
              onClick={() => toggleShiny(selectedPokemon.pokedexId)}
              className={`w-full font-headline uppercase px-4 py-2 border-3 border-black transition mb-4 ${
                isShinyEnabled
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-surface-container-lowest text-on-surface'
              }`}
            >
              {isShinyEnabled ? '✨ SHINY' : '⭕ NORMAL'} SPRITE
            </button>
          )}

          {/* Stats */}
          <div className="bg-surface-container-lowest border-2 border-black p-3 mb-4">
            <h3 className="font-headline text-headline-sm text-primary uppercase mb-3">
              Base Stats
            </h3>
            <div className="grid grid-cols-2 gap-2 text-body-sm">
              <div>HP: <span className="text-primary">{selectedPokemon.baseStats?.hp}</span></div>
              <div>ATK: <span className="text-primary">{selectedPokemon.baseStats?.attack}</span></div>
              <div>DEF: <span className="text-primary">{selectedPokemon.baseStats?.defense}</span></div>
              <div>SpA: <span className="text-primary">{selectedPokemon.baseStats?.specialAttack}</span></div>
              <div>SpD: <span className="text-primary">{selectedPokemon.baseStats?.specialDefense}</span></div>
              <div>SPD: <span className="text-primary">{selectedPokemon.baseStats?.speed}</span></div>
            </div>
          </div>

          {/* Types */}
          <div className="flex gap-2">
            {selectedPokemon.types?.map((type: string) => (
              <span
                key={type}
                className="px-3 py-1 bg-primary text-on-primary font-headline text-body-sm rounded uppercase"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

### 8.4: Backend Sprite Shiny Endpoint

**Crear en `backend/src/routes/pokemon.ts`:**

```typescript
import { toShowdownName } from '../lib/sprites'; // si existe

/**
 * GET /api/pokemon/sprite/:pokedexId?shiny=true
 * Retorna URL del sprite (normal o shiny)
 */
app.get('/sprite/:pokedexId', async (c: Context) => {
  try {
    const { pokedexId } = c.req.param();
    const isShiny = c.req.query('shiny') === 'true';

    const pokemon = await PokemonModel.findOne({ pokedexId: parseInt(pokedexId) });
    if (!pokemon) return c.json({ error: 'Pokemon not found' }, 404);

    const spriteUrl = isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokedexId}.png`
      : `https://play.pokemonshowdown.com/sprites/ani/${toShowdownName(pokemon.name)}.gif`;

    return c.json({ spriteUrl, isShiny });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
```

---

### 8.5: Battle Screen Mostrar Shiny

**Modificar `frontend/src/app/routes/battle.tsx`:**

```tsx
function BattlePokemonSprite({
  pokemon,
  isPlayerPokemon,
  shinyEnabled,
  isPremium,
}: {
  pokemon: any;
  isPlayerPokemon: boolean;
  shinyEnabled: boolean;
  isPremium: boolean;
}) {
  const spriteUrl =
    shinyEnabled && isPremium
      ? `${API_URL}/pokemon/sprite/${pokemon.pokedexId}?shiny=true`
      : isPlayerPokemon
        ? getBackSprite(pokemon.name)
        : getFrontSprite(pokemon.name);

  return (
    <div className="pokemon-sprite w-40 h-40 flex items-center justify-center">
      <img
        src={spriteUrl}
        alt={pokemon.name}
        className="image-rendering-pixelated max-w-full max-h-full"
      />
    </div>
  );
}
```

---

### 8.6: Guardar Shiny en Team (Team Builder)

**Modificar `frontend/src/app/routes/teams.tsx`:**

```typescript
const saveTeam = async () => {
  const teamData = {
    odiserId: user?.id,
    name: `Team ${new Date().toLocaleDateString()}`,
    pokemons: currentTeam.map(p => ({
      pokemonId: p.pokemonId,
      ability: p.ability,
      moves: p.moves,
      shiny: false,
      shinyEnabled: p.shinyEnabled, // ← GUARDAR
    })),
  };

  const res = await fetch(`${API_URL}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamData),
  });

  if (res.ok) {
    alert('Team guardado!');
  }
};
```

---

### 8.7: Cargar Shiny al Recuperar Team

**En `frontend/src/app/routes/battle.tsx`:**

```typescript
const loadTeamFromDB = async (teamId: string) => {
  const res = await fetch(`${API_URL}/teams/${teamId}`);
  const team = await res.json();

  // Restaurar preferencias shiny en store
  team.pokemons.forEach((p: any) => {
    if (p.shinyEnabled) {
      useTeamStore.getState().toggleShiny(p.pokemonId);
    }
  });

  // ... resto
};
```

---

## 🔷 FASE 9: MÚSICA PREMIUM EN BATALLA

### 9.1: Función selectBattleMusic (Backend)

**Crear/Actualizar `backend/src/services/battleEngine.ts`:**

```typescript
/**
 * Seleccionar música de batalla según modo y disponibilidad de Premium
 */
export function selectBattleMusic(
  battleMode: 'casual' | 'ranked',
  hasAnyPremium: boolean
): string {
  if (hasAnyPremium) {
    const premiumTracks = [
      'sonidos/Music/Batalla_Premium1.mp3',
      'sonidos/Music/Batalla_Premium2.mp3',
      'sonidos/Music/Batalla_Premium3.mp3',
    ];
    const randomIndex = Math.floor(Math.random() * premiumTracks.length);
    console.log(`[BATTLE] Selected premium track: ${premiumTracks[randomIndex]}`);
    return premiumTracks[randomIndex];
  }

  const normalTrack =
    battleMode === 'ranked'
      ? 'sonidos/Music/Batalla_Ranked.mp3'
      : 'sonidos/Music/Batalla_Casual.mp3';

  console.log(`[BATTLE] Selected normal track: ${normalTrack}`);
  return normalTrack;
}
```

---

### 9.2: Enviar Premium Info en BATTLE_STARTED

**Modificar `backend/src/routes/battle.ts`:**

```typescript
import { selectBattleMusic } from '../services/battleEngine';
import { UserModel } from '../models';

export async function startBattle(roomCode: string) {
  try {
    // ... validaciones existentes ...

    // Obtener usuarios para verificar Premium
    const player1User = await UserModel.findOne({ odiserId: players[0].odiserId });
    const player2User = await UserModel.findOne({ odiserId: players[1].odiserId });

    const player1HasPremium = player1User?.isPremium ?? false;
    const player2HasPremium = player2User?.isPremium ?? false;
    const hasAnyPremium = player1HasPremium || player2HasPremium;

    // Seleccionar música
    const selectedBattleMusic = selectBattleMusic(room.mode, hasAnyPremium);

    // Crear batalla...
    const battleDoc = await BattleModel.create({
      roomCode,
      turn: 1,
      status: 'active',
      players: battlePlayers,
      battleLog: [],
      winnerUserId: null,
    });

    // Broadcast BATTLE_STARTED con info Premium
    broadcastToRoom(roomCode, {
      type: 'BATTLE_STARTED',
      battle: battleDoc.toObject(),
      premiumInfo: {
        player1HasPremium,
        player2HasPremium,
      },
      selectedBattleMusic, // ← NUEVA MÚSICA
    });

    return { ok: true, battleId: battleDoc._id };
  } catch (err: any) {
    console.error('[BATTLE] Error:', err);
    throw err;
  }
}
```

---

### 9.3: Actualizar Tipos WS

**Modificar `frontend/src/types/index.ts`:**

```typescript
export type WsMessage =
  | {
      type: 'BATTLE_STARTED';
      battle: BattleState;
      premiumInfo?: {
        player1HasPremium: boolean;
        player2HasPremium: boolean;
      };
      selectedBattleMusic?: string; // ← NUEVO
    }
  | { type: 'TURN_RESOLVED'; battle: BattleState }
  | { type: 'BATTLE_ENDED'; winnerUserId: string }
  | { type: 'PLAYER_CONNECTED'; playerId: string; roomCode: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; roomCode: string }
  | { type: 'LOBBY_READY'; roomCode: string }
  | { type: 'CHAT_MESSAGE'; text: string; playerId: string; name: string }
  | { type: 'PING' }
  | { type: 'PONG' };
```

---

### 9.4: MusicProvider Maneja selectedBattleMusic

**Modificar `frontend/src/components/MusicProvider.tsx`:**

```tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useBattleSocket } from '../lib/useBattleSocket';
import { getMusicManager } from '../lib/musicManager';
import type { WsMessage } from '../types';

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [selectedBattleMusic, setSelectedBattleMusic] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Extraer roomCode y playerId de URL
  useEffect(() => {
    const matches = pathname.match(/\/battle\/([^\/]+)/);
    if (matches) {
      setRoomCode(matches[1]);
      // Asume playerId en localStorage o similar
      const id = localStorage.getItem('playerId');
      if (id) setPlayerId(id);
    }
  }, [pathname]);

  // Escuchar eventos WS
  const handleWsMessage = (msg: WsMessage) => {
    if (msg.type === 'BATTLE_STARTED' && msg.selectedBattleMusic) {
      setSelectedBattleMusic(msg.selectedBattleMusic);
      console.log(`[MUSIC] Battle music selected: ${msg.selectedBattleMusic}`);
    }
  };

  useBattleSocket({
    roomCode: roomCode || '',
    playerId: playerId || '',
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    const musicManager = getMusicManager();
    const baseRoute = pathname.split('/').slice(0, 2).join('/') || '/';

    // Si estamos en batalla y tenemos música seleccionada, usarla
    if (baseRoute === '/battle' && selectedBattleMusic) {
      musicManager.playMusic(selectedBattleMusic, 300);
    } else if (baseRoute !== '/battle') {
      // Si no estamos en batalla, reproducir música normal
      const normalMusic = getMusicForRoute(pathname);
      musicManager.playMusic(normalMusic, 300);
    }
  }, [pathname, selectedBattleMusic]);

  return <>{children}</>;
}

function getMusicForRoute(pathname: string): string {
  const MUSIC_MAP: Record<string, string> = {
    '/': 'sonidos/Music/Musica_Titulo.mp3',
    '/title': 'sonidos/Music/Musica_Titulo.mp3',
    '/home': 'sonidos/Music/Musica_Home.mp3',
    '/pokedex': 'sonidos/Music/Musica_Pokedex.mp3',
    '/rules': 'sonidos/Music/Musica_Home.mp3',
    '/room': 'sonidos/Music/Musica_Lobby.mp3',
    '/play': 'sonidos/Music/Musica_Lobby.mp3',
    '/teams': 'sonidos/Music/Musica_Lobby.mp3',
    '/battle': 'sonidos/Music/Batalla_Casual.mp3', // default
    '/results': 'sonidos/Music/Victoria_Casual.mp3',
    '/premium': 'sonidos/Music/Musica_Home.mp3',
  };

  const baseRoute = pathname.split('/').slice(0, 2).join('/') || '/';
  return MUSIC_MAP[baseRoute] || MUSIC_MAP['/home'];
}
```

---

### 9.5: Actualizar Music Store (Opcional)

**En `frontend/src/stores/musicStore.ts`:**

```typescript
interface MusicState {
  currentMusic: string | null;
  isPlaying: boolean;
  volume: number;
  battleMode: 'casual' | 'ranked' | null;
  premiumInfo?: {
    player1HasPremium: boolean;
    player2HasPremium: boolean;
  };

  setCurrentMusic: (path: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setPremiumInfo: (info: MusicState['premiumInfo']) => void;
}

export const useMusicStore = create<MusicState>(set => ({
  currentMusic: null,
  isPlaying: false,
  volume: 0.3,
  battleMode: null,
  premiumInfo: undefined,

  setCurrentMusic: (path) => set({ currentMusic: path }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setPremiumInfo: (info) => set({ premiumInfo: info }),
}));
```

---

## 🎯 FLUJO COMPLETO

```
1. COMPRA PREMIUM
   ├─ User en /home → click "PREMIUM" button
   ├─ Navega a /premium
   ├─ Completa pago con tarjeta Stripe
   ├─ Backend recibe webhook payment_intent.succeeded
   ├─ BD actualiza isPremium = true, premiumPurchasedAt = now()
   ├─ User redirigido a /home
   └─ Botón ahora dice "PREMIUM (Active)"

2. SELECCIONAR SHINY EN POKÉDEX
   ├─ User en /pokedex → busca Pokémon favorito
   ├─ Ve botón "⭕ NORMAL SPRITE" (si isPremium)
   ├─ Click → cambia a "✨ SHINY SPRITE"
   ├─ Sprite cambia a versión shiny
   └─ Preferencia guardada en teamStore (shinyEnabled: true)

3. ARMAR TEAM CON SHINY
   ├─ User en /teams → agrega Pokémon con shiny enabled
   ├─ Team guardado con shinyEnabled: true en DB
   └─ Preferencia persistida

4. BATALLA CON SHINY + MÚSICA PREMIUM
   ├─ Backend verifica: "al menos 1 tiene Premium"
   ├─ selectBattleMusic() → random entre 3 premium
   ├─ WebSocket envía BATTLE_STARTED con selectedBattleMusic
   ├─ Frontend reproduce música premium (random)
   └─ Sprites shiny se muestran correctamente
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Fase 7: Stripe + Premium UI
- [ ] `npm install stripe` en backend
- [ ] `npm install @stripe/react-stripe-js` en frontend
- [ ] Variables .env en backend y frontend configuradas
- [ ] Endpoints `/api/payments/intent`, `/api/payments/confirm` funcionan
- [ ] Webhook `/api/stripe-webhook` verifica firma correctamente
- [ ] Página `/premium` carga sin errores
- [ ] Sidebar home muestra botón Premium
- [ ] Flow: login → home → /premium → pago → isPremium = true

### Fase 8: Shiny Toggle
- [ ] Team model extendido con `shinyEnabled`
- [ ] Pokédex UI muestra toggle (si isPremium)
- [ ] Toggle cambia sprite a shiny
- [ ] Preferencia guardada en teamStore
- [ ] Backend endpoint `/api/pokemon/sprite/:id?shiny=true` funciona
- [ ] Battle screen muestra sprite shiny si fue seleccionado

### Fase 9: Música Premium
- [ ] `selectBattleMusic()` retorna random entre 3 si Premium
- [ ] WebSocket envía `selectedBattleMusic` en BATTLE_STARTED
- [ ] MusicProvider recibe y reproduce música premium
- [ ] Console log muestra selección correcta

---

## 🧪 TESTING CON STRIPE TEST MODE

**Tarjetas de prueba:**
- ✅ Exitosa: `4242 4242 4242 4242` (CVC: cualquiera, exp: futuro)
- ❌ Rechazada: `4000 0000 0000 0002`
- ⚠️ Fallo de autenticación: `4000 0025 0000 0003`

**Webhook testing (local):**
Usar `ngrok` o similar para exponer localhost en HTTPS:
```bash
ngrok http 3001
# Configurar webhook URL: https://xxx.ngrok.io/api/stripe-webhook
```

---

## 📝 NOTAS IMPORTANTES

- **No hacer `npm run build`** después de cambios
- **No en producción** — test solo en test mode Stripe
- **Webhook verification** es crítico para seguridad
- **Premium es de por vida** — no requiere renovación
- **Shiny + Música** son independientes pero ambas requieren Premium
- **Si un jugador tiene Premium** → ambos disfrutan música premium en batalla

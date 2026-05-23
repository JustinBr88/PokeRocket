import { Hono } from 'hono';
import { UserModel } from '../models/index';
import { stripeService } from '../services/stripeService';

const payments = new Hono();
const PREMIUM_PRICE = Number(process.env.PREMIUM_PRICE || 7777);

// Helper: ensure user exists in DB (called on endpoints that need user)
async function ensureUserExists(odiserId: string, username?: string, avatarUrl?: string) {
  let user = await UserModel.findOne({ odiserId });
  if (!user) {
    // Auto-create user if not found (handles legacy users before webhook setup)
    user = await UserModel.create({
      odiserId,
      username: username ?? odiserId,
      avatarUrl: avatarUrl ?? null,
      elo: 1500,
      wins: 0,
      losses: 0,
      isActive: true,
      isPremium: false,
    });
    console.log(`[Payments] Auto-created user: ${odiserId}`);
  }
  return user;
}

// POST /api/payments/intent - crear PaymentIntent
payments.post('/intent', async (c) => {
  try {
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ error: 'userId required' }, 400);
    }

    // Ensure user exists in DB (auto-creates if not found)
    const user = await ensureUserExists(userId);

    if (user.isPremium) {
      return c.json({ error: 'User already has premium' }, 400);
    }

    // Crear payment intent en Stripe
    const paymentIntent = await stripeService.createPaymentIntent(
      userId,
      user.username || userId,
      PREMIUM_PRICE
    );

    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: PREMIUM_PRICE,
      currency: 'usd',
    });
  } catch (error) {
    console.error('Error in POST /intent:', error);
    return c.json({ error: 'Failed to create payment intent' }, 500);
  }
});

// POST /api/payments/confirm - confirmar pago completado
payments.post('/confirm', async (c) => {
  try {
    const { userId, paymentIntentId } = await c.req.json();

    if (!userId || !paymentIntentId) {
      return c.json({ error: 'userId and paymentIntentId required' }, 400);
    }

    // Ensure user exists in DB
    await ensureUserExists(userId);

    // Verificar estado del payment intent en Stripe
    const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return c.json({ error: 'Payment not succeeded' }, 400);
    }

    // Actualizar usuario en BD
    const user = await UserModel.findOneAndUpdate(
      { odiserId: userId },
      {
        isPremium: true,
        premiumPurchasedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
      { new: true }
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      ok: true,
      message: 'Premium activated successfully',
      user: {
        id: user._id,
        odiserId: user.odiserId,
        username: user.username,
        isPremium: user.isPremium,
        premiumPurchasedAt: user.premiumPurchasedAt,
      },
    });
  } catch (error) {
    console.error('Error in POST /confirm:', error);
    return c.json({ error: 'Failed to confirm payment' }, 500);
  }
});

// GET /api/payments/check-premium/:userId - verificar estado Premium
payments.get('/check-premium/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    if (!userId) {
      return c.json({ error: 'userId required' }, 400);
    }

    // Auto-create user if not found (ensures new users get proper tracking)
    const user = await ensureUserExists(userId);

    return c.json({
      isPremium: user.isPremium,
      premiumPurchasedAt: user.premiumPurchasedAt,
    });
  } catch (error) {
    console.error('Error in GET /check-premium:', error);
    return c.json({ error: 'Failed to check premium status' }, 500);
  }
});

export default payments;

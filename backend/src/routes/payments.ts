import { Hono } from 'hono';
import { UserModel } from '../models/index';
import { stripeService } from '../services/stripeService';

const payments = new Hono();
const PREMIUM_PRICE = Number(process.env.PREMIUM_PRICE || 7777);

// POST /api/payments/intent - crear PaymentIntent
payments.post('/intent', async (c) => {
  try {
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ error: 'userId required' }, 400);
    }

    // Verificar que el usuario existe y obtener su email de Clerk
    // Por ahora usamos el userId como email (será mejorado con lookup de Clerk)
    const user = await UserModel.findOne({ odiserId: userId });
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

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

    const user = await UserModel.findOne({ odiserId: userId });
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

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

import { Hono } from 'hono';
import { UserModel } from '../models/index';
import { stripeService } from '../services/stripeService';
import Stripe from 'stripe';

const stripeWebhook = new Hono();

// POST /api/stripe-webhook - Webhook handler para Stripe
stripeWebhook.post('/', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    const body = await c.req.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret');
      return c.json({ error: 'Invalid webhook' }, 400 as any);
    }

    // Verificar firma del webhook
    let event: Stripe.Event;
    try {
      event = await stripeService.verifyWebhookSignature(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return c.json({ error: 'Invalid signature' }, 400 as any);
    }

    // Manejar eventos
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;

      if (userId) {
        console.log(`[Webhook] Payment succeeded for user ${userId}`);

        // Actualizar usuario en BD
        await UserModel.findOneAndUpdate(
          { odiserId: userId },
          {
            isPremium: true,
            premiumPurchasedAt: new Date(),
            stripePaymentIntentId: paymentIntent.id,
          }
        );
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.userId;

      console.warn(
        `[Webhook] Payment failed for user ${userId}: ${(paymentIntent as any).last_payment_error?.message}`
      );
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500 as any);
  }
});

export default stripeWebhook;

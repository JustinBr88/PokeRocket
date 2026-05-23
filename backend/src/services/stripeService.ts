import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY not configured');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10' as any,
});

export const stripeService = {
  async createPaymentIntent(userId: string, email: string, amount: number = 1499) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          userId,
          email,
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  async confirmPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw error;
    }
  },

  async verifyWebhookSignature(body: string, signature: string, webhookSecret: string) {
    try {
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      return event;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      throw error;
    }
  },

  getStripeInstance() {
    return stripe;
  },
};

import { Hono } from 'hono';
import { Webhook } from 'svix';
import { UserModel } from '../models/index';
import type { Context } from 'hono';

const auth = new Hono();

// POST /api/auth/webhook — Clerk webhook handler
auth.post('/webhook', async (c: Context) => {
  const payload = await c.req.text();
  const headers = c.req.header();

  // Clerk uses svix for webhook verification
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  try {
    const event = wh.verify(payload, headers) as any;

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const data = event.data;
        const email = (data.email_addresses as any[])?.[0]?.email_address ?? '';
        const username = data.username ?? data.first_name ?? email.split('@')[0];
        await UserModel.findOneAndUpdate(
          { odiserId: data.id },
          {
            odiserId: data.id,
            username,
            avatarUrl: data.image_url,
            isActive: true,
          },
          { upsert: true, new: true },
        );
        break;
      }
      case 'user.deleted': {
        const data = event.data;
        await UserModel.findOneAndUpdate(
          { odiserId: data.id },
          { isActive: false },
        );
        break;
      }
    }

    return c.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Verification failed:', err);
    return c.json({ error: 'Webhook verification failed' }, 400);
  }
});

// GET /api/auth/user/:userId — get user by odiserId
auth.get('/user/:userId', async c => {
  const user = await UserModel.findOne({ odiserId: c.req.param('userId') }).lean();
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

export default auth;
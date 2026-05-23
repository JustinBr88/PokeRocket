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
        const isPremium = data.public_metadata?.isPremium === true || data.unsafe_metadata?.isPremium === true;
        await UserModel.findOneAndUpdate(
          { odiserId: data.id },
          {
            odiserId: data.id,
            username,
            avatarUrl: data.image_url,
            isActive: true,
            isPremium,
          },
          { upsert: true, new: true },
        );
        if (isPremium) {
          console.log(`[Webhook] User ${data.id} synced with isPremium: true`);
        }
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

// POST /api/auth/ensure-user — idempotent upsert (used by auth/setup page)
// Ensures user exists in MongoDB before navigating to /home
auth.post('/ensure-user', async c => {
  try {
    const { odiserId, username, avatarUrl, isPremium } = await c.req.json();

    if (!odiserId) {
      return c.json({ error: 'odiserId required' }, 400);
    }

    const user = await UserModel.findOneAndUpdate(
      { odiserId },
      {
        odiserId,
        username: username ?? 'Player',
        avatarUrl: avatarUrl ?? '',
        isActive: true,
        ...(isPremium !== undefined && { isPremium }),
      },
      { upsert: true, new: true },
    );

    if (isPremium) {
      console.log(`[ensure-user] User ${odiserId} set as premium`);
    }

    return c.json(user);
  } catch (err) {
    console.error('[ensure-user] Error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;
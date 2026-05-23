import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectDB } from './db';
import roomsRoute from './routes/rooms';
import teamsRoute from './routes/teams';
import battleRoute from './routes/battle';
import pokemonRoute from './routes/pokemon';
import movesetsRoute from './routes/movesets';
import authRoute from './routes/auth';
import paymentsRoute from './routes/payments';
import stripeWebhookRoute from './routes/stripeWebhook';
import { wsHandlers } from './ws/handler';

const app = new Hono();
app.use('/*', cors({ origin: '*' }));
app.use('/*', logger());

// REST routes only (NO WebSocket route here)
app.route('/api/rooms', roomsRoute);
app.route('/api/teams', teamsRoute);
app.route('/api/battle', battleRoute);
app.route('/api/pokemon', pokemonRoute);
app.route('/api/movesets', movesetsRoute);
app.route('/api/auth', authRoute);
app.route('/api/payments', paymentsRoute);
app.route('/api/stripe-webhook', stripeWebhookRoute);

// Health check
app.get('/health', c => c.json({ ok: true }));

await connectDB();

// Start Bun server with WebSocket support
const port = Number(process.env.PORT ?? 3001);

export default {
  port,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    
    // Try WebSocket upgrade for /ws/... paths
    if (url.pathname.startsWith('/ws/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 3) {
        const roomCode = parts[1];
        const playerId = parts[2];
        if (roomCode && playerId) {
          const success = server.upgrade(req, {
            data: { roomCode, playerId },
          });
          if (success) {
            console.log(`[WS] Upgrade successful for ${playerId} in room ${roomCode}`);
            return; // Don't return a Response when upgrade succeeds
          }
        }
      }
      // If upgrade failed, return error
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    
    // All non-WS requests go to Hono
    return app.fetch(req);
  },
  websocket: wsHandlers,
};
import { Hono } from 'hono';
import { MovesetModel } from '../models/Moveset';

const app = new Hono();

// GET /api/movesets — todos los movesets
app.get('/', async (c) => {
  const movesets = await MovesetModel.find().sort({ pokemonId: 1 });
  return c.json(movesets);
});

// GET /api/movesets/:pokemonId — moveset de un Pokémon
app.get('/:pokemonId', async (c) => {
  const pokemonId = parseInt(c.req.param('pokemonId'));
  const moveset = await MovesetModel.findOne({ pokemonId });
  if (!moveset) return c.json({ error: 'Moveset not found' }, 404);
  return c.json(moveset);
});

export default app;
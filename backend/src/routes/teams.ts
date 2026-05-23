import { Hono } from 'hono';
import { TeamModel } from '../models/index';

const teams = new Hono();

// POST /api/teams — create or update team
teams.post('/', async c => {
  const { odiserId, name, pokemons } = await c.req.json();

  // Validate pokemons array (exactly 6)
  if (!pokemons || pokemons.length !== 6) {
    return c.json({ error: 'Team must have exactly 6 Pokémon' }, 400);
  }

  // Validate each pokemon exists
  const resolvedPokemons = [];
  for (const p of pokemons) {
    resolvedPokemons.push({
      pokemonId: p.pokemonId,
      shiny: p.shiny ?? false,
      shinyEnabled: p.shinyEnabled ?? false,
    });
  }

  // Upsert: find existing team for this user or create new
  const existing = await TeamModel.findOne({ odiserId });
  if (existing) {
    existing.name = name;
    existing.pokemons = resolvedPokemons as any;
    await existing.save();
    return c.json({ ok: true, teamId: existing._id });
  }

  const team = await TeamModel.create({ odiserId, name, pokemons: resolvedPokemons });
  return c.json({ ok: true, teamId: team._id });
});

// GET /api/teams/:odiserId — get user's team
teams.get('/:odiserId', async c => {
  const team = await TeamModel.findOne({ odiserId: c.req.param('odiserId') }).lean();
  if (!team) return c.json({ error: 'Team not found' }, 404);
  return c.json(team);
});

export default teams;
import { Hono } from 'hono';
import { PokemonModel } from '../models/index';

const pokemon = new Hono();

// GET /api/pokemon?q=&type=&legendary=&page=&limit=
pokemon.get('/', async c => {
  const { q, type, legendary, page = '1', limit = '30' } = c.req.query();
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: 'i' };
  if (type) filter.types = type;
  if (legendary === 'true') filter.isLegendary = true;
  if (legendary === 'false') filter.isLegendary = false;
  const skip = (Number(page) - 1) * Number(limit);
  const data = await PokemonModel.find(filter).skip(skip).limit(Number(limit)).lean();
  const total = await PokemonModel.countDocuments(filter);
  return c.json({ data, total, page: Number(page), limit: Number(limit) });
});

// GET /api/pokemon/:id
pokemon.get('/:id', async c => {
  // Support both MongoDB _id and pokedexId
  const param = c.req.param('id');
  let data;
  if (param.match(/^[a-fA-F0-9]{24}$/)) {
    data = await PokemonModel.findById(param).populate('moveIds').lean();
  } else {
    data = await PokemonModel.findOne({ pokedexId: Number(param) }).populate('moveIds').lean();
  }
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

// GET /api/pokemon/sprite/:pokedexId?shiny=true
pokemon.get('/sprite/:pokedexId', async c => {
  const pokedexId = c.req.param('pokedexId');
  const shiny = c.req.query('shiny') === 'true';

  // Validar que pokedexId sea un número
  const pokedexIdNum = Number(pokedexId);
  if (isNaN(pokedexIdNum) || pokedexIdNum < 1) {
    return c.json({ error: 'Invalid pokedexId' }, 400);
  }

  let spriteUrl: string;
  if (shiny) {
    // Sprite shiny desde PokeAPI
    spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokedexIdNum}.png`;
  } else {
    // Sprite normal desde PokeAPI (fallback)
    spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokedexIdNum}.png`;
  }

  return c.json({ spriteUrl, isShiny: shiny });
});

export default pokemon;
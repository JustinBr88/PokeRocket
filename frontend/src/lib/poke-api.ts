import { API_URL } from './sprites';
import type { PokemonAPI } from '../types';

export async function getPokemon(id: string): Promise<PokemonAPI> {
  const res = await fetch(`${API_URL}/pokemon/${id}`);
  if (!res.ok) throw new Error('Pokemon not found');
  return res.json();
}

export async function searchPokemon(params: {
  q?: string;
  type?: string;
  legendary?: boolean;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.type) qs.set('type', params.type);
  if (params.legendary !== undefined) qs.set('legendary', String(params.legendary));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit ?? 30));

  const res = await fetch(`${API_URL}/pokemon?${qs}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{ data: PokemonAPI[]; total: number; page: number; limit: number }>;
}
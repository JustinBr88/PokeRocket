import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL } from '../../lib/sprites';
import { getFrontSprite, getFrontSpriteShiny } from '../../lib/sprites';
import type { PokemonAPI, Moveset } from '../../types';

const TYPES = ['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel'];

export default function PokedexPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const isPremium = user && (user.publicMetadata?.isPremium === true || user.unsafeMetadata?.isPremium === true);
  const [pokemonList, setPokemonList] = useState<PokemonAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonAPI | null>(null);
  const [selectedMoveset, setSelectedMoveset] = useState<Moveset | null>(null);
  const [movesetLoading, setMovesetLoading] = useState(false);
  const [viewShiny, setViewShiny] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/pokemon?limit=300`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPokemonList(data);
        } else if (data.data && Array.isArray(data.data)) {
          setPokemonList(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[Pokédex] Error fetching:', err);
        setLoading(false);
      });
  }, []);

  async function handleSelectPokemon(pokemon: PokemonAPI) {
    setSelectedPokemon(pokemon);
    setSelectedMoveset(null);
    setMovesetLoading(true);
    setViewShiny(false);
    try {
      const movesetRes = await fetch(`${API_URL}/movesets/${pokemon.pokedexId}`);
      if (movesetRes.ok) {
        const moveset: Moveset = await movesetRes.json();
        setSelectedMoveset(moveset);
      }
    } catch (err) {
      console.error('[Pokédex] Error loading moveset:', err);
    } finally {
      setMovesetLoading(false);
    }
  }

  const filteredPokemon = pokemonList.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || p.types.includes(filterType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="crt-overlay" />
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
          aria-label="Volver a home"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">Pokédex</h1>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Main Grid Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="bg-surface-container-high border-b-3 border-black p-4">
            <div className="flex flex-col md:flex-row gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary">search</span>
                <input
                  className="w-full bg-surface-container-lowest border-3 border-black p-3 pl-12 text-primary font-body focus:ring-0 focus:border-primary uppercase chamfer-tl"
                  placeholder="SEARCH POKEMON..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="bg-surface-container-lowest border-3 border-black text-on-surface-variant p-2 font-label-lg uppercase chamfer-br"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">TYPE: ALL</option>
                {TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pokemon Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-12"><div className="pokeball-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-w-[1600px] mx-auto">
                {filteredPokemon.map(pokemon => (
                  <div
                    key={pokemon._id}
                    onClick={() => handleSelectPokemon(pokemon)}
                    className={`bg-surface-container border-3 border-black p-3 cursor-pointer hover:border-primary transition-all chamfer-tl ${
                      selectedPokemon?._id === pokemon._id ? 'border-primary bg-surface-container-high' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">#{String(pokemon.pokedexId).padStart(3, '0')}</span>
                      {pokemon.isLegendary && <span className="text-primary">★</span>}
                      {pokemon.isMythical && <span className="text-secondary">✦</span>}
                    </div>
                    <img
                      src={getFrontSprite(pokemon.name)}
                      alt={pokemon.name}
                      className="w-full aspect-square object-contain grayscale hover:grayscale-0 transition-all"
                      onError={e => { (e.target as HTMLImageElement).src = pokemon.spriteUrl; }}
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="mt-2 text-center">
                      <div className="font-label-lg text-label-lg text-on-surface uppercase font-bold truncate text-xs">{pokemon.name}</div>
                      <div className="flex justify-center gap-1 mt-1 flex-wrap">
                        {pokemon.types.map(t => (
                          <span key={t} className={`type-${t.toLowerCase()} text-[8px] px-1 py-0.5 border border-black uppercase`}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedPokemon && (
          <aside className="w-80 bg-surface-container-high border-l-4 border-black p-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* Close button */}
              <button
                onClick={() => {
                  setSelectedPokemon(null);
                  setSelectedMoveset(null);
                }}
                className="self-end w-8 h-8 bg-surface-container flex items-center justify-center border-2 border-black hover:bg-primary hover:text-on-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>

              {/* Sprite & Name */}
              <div className="text-center">
                <img
                  src={viewShiny && isPremium ? getFrontSpriteShiny(selectedPokemon.name) : getFrontSprite(selectedPokemon.name)}
                  alt={selectedPokemon.name}
                  className="w-40 h-40 object-contain mx-auto"
                  onError={e => { (e.target as HTMLImageElement).src = selectedPokemon.spriteUrl; }}
                  style={{ imageRendering: 'pixelated' }}
                />
                {/* Shiny toggle - premium only */}
                {isPremium && (
                  <button
                    onClick={() => setViewShiny(prev => !prev)}
                    className="mt-2 px-3 py-1 bg-tertiary text-on-tertiary border-2 border-black font-label-sm uppercase hover:bg-tertiary-container transition-colors"
                  >
                    {viewShiny ? '★ SHINY ACTIVE — TAP TO NORMAL' : '★ VIEW SHINY'}
                  </button>
                )}
                <div className="mt-2 px-4 py-1 bg-surface-container-lowest border-2 border-black chamfer-tl inline-block">
                  <span className="font-headline text-headline-md text-primary uppercase">{selectedPokemon.name}</span>
                </div>
                <div className="flex justify-center gap-2 mt-2">
                  {selectedPokemon.types.map(t => (
                    <span key={t} className={`type-${t.toLowerCase()} font-label-lg text-label-lg px-3 py-1 border-2 border-black uppercase`}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="flex justify-center gap-2">
                {selectedPokemon.isLegendary && (
                  <span className="bg-primary/20 text-primary border-2 border-primary px-3 py-1 font-label-sm uppercase">Legendary</span>
                )}
                {selectedPokemon.isMythical && (
                  <span className="bg-secondary/20 text-secondary border-2 border-secondary px-3 py-1 font-label-sm uppercase">Mythical</span>
                )}
              </div>

              {/* Role */}
              {selectedPokemon.role && (
                <div className="bg-surface-container border-2 border-black p-3 text-center">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Role</span>
                  <div className="font-headline text-headline-md text-primary uppercase mt-1">{selectedPokemon.role}</div>
                </div>
              )}

              {/* Stats */}
              <div className="space-y-2">
                <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-black pb-1">Base Statistics</h3>
                {selectedPokemon.baseStats && Object.entries(selectedPokemon.baseStats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between items-center font-label-sm text-label-sm uppercase">
                    <span className="text-on-surface-variant">{stat.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-surface-container-low border border-black">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, (Number(value) / 255) * 100)}%` }}
                        />
                      </div>
                      <span className="text-primary font-bold w-8 text-right">{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Moves */}
              {selectedMoveset && selectedMoveset.moves && selectedMoveset.moves.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-black pb-1">
                    Available Moves ({selectedMoveset.moves.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedMoveset.moves.map((move) => (
                      <div key={move.moveId} className={`bg-surface-container border-2 border-black p-2 relative ${move.famous ? 'ring-2 ring-yellow-400' : ''}`}>
                        {move.famous && (
                          <span className="absolute -top-2 -right-2 text-yellow-400 text-lg">★</span>
                        )}
                        <div className="flex justify-between items-start">
                          <span className="font-label-lg text-label-lg text-on-surface uppercase">{move.moveName}</span>
                          <span className={`type-${move.type.toLowerCase()} text-[10px] px-1 py-0.5 border border-black uppercase`}>
                            {move.type}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-on-surface-variant uppercase gap-1">
                          <span>PWR: {move.power ?? '—'}</span>
                          <span>ACC: {move.accuracy ?? '—'}</span>
                          <span>{move.damageClass?.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {movesetLoading && (
                <div className="flex justify-center py-4">
                  <div className="pokeball-spin" />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
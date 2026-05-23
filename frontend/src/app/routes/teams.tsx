import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { searchPokemon } from '../../lib/poke-api';
import { getFrontSprite, API_URL } from '../../lib/sprites';
import { useTeamStore } from '../../stores/teamStore';
import { useBattleSocket } from '../../lib/useBattleSocket';
import type { PokemonAPI } from '../../types';

export default function TeamsPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const { currentTeam, addPokemon, removePokemon, clearTeam, toggleShiny } = useTeamStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [pokemonList, setPokemonList] = useState<PokemonAPI[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonAPI | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomMode, setRoomMode] = useState<'casual' | 'ranked' | null>(null);
  const [isTeamReady, setIsTeamReady] = useState(false);
  const [showRetro, setShowRetro] = useState(false);
  const [isPremiumChecked, setIsPremiumChecked] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Premium check - use backend like home.tsx does, not Clerk metadata
  useEffect(() => {
    if (!user) return;

    const checkPremiumStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/payments/check-premium/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setIsPremium(data.isPremium);
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      } finally {
        setIsPremiumChecked(true);
      }
    };

    checkPremiumStatus();
  }, [user]);

  const TYPES = ['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel'];

  // Fetch room mode on mount
  useEffect(() => {
    if (!roomId) return;
    fetch(`${API_URL}/rooms/${roomId}`)
      .then(r => r.json())
      .then(data => setRoomMode(data.mode))
      .catch(console.error);
  }, [roomId]);

  // Load all 300 Pokémon on mount
  useEffect(() => {
    handleSearch();
  }, []);

  async function handleSearch() {
    setLoading(true);
    try {
      const result = await searchPokemon({
        q: searchQuery || undefined,
        type: filterType || undefined,
        limit: 300,
      });
      setPokemonList(result.data);
    } catch (err) {
      console.error('[Teams] Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPokemon(pokemon: PokemonAPI) {
    setSelectedPokemon(pokemon);
  }

  // Add pokemon directly to team (no move selection - moves are automatic from famous)
  function handleAddToTeam(pokemon: PokemonAPI) {
    if (currentTeam.length >= 6) return;

    const result = addPokemon(pokemon.pokedexId, pokemon.name, pokemon.isLegendary);
    if (!result.success) {
      alert(result.reason);
      return;
    }

    // If showing retro and premium, enable retro for this newly added pokemon
    if (showRetro && isPremium) {
      toggleShiny(pokemon.pokedexId);
    }
    setSelectedPokemon(null);
  }

  function handleCancelTeam() {
    clearTeam();
  }

  // Save team to backend (does NOT mark ready)
  async function saveTeam() {
    if (!user || currentTeam.length === 0) return false;

    const playerId = user.id;

    // Build team payload (no moves - they're automatic from famous)
    const teamPayload = {
      odiserId: playerId,
      name: user.username ?? 'Player',
      pokemons: currentTeam.map(slot => ({
        pokemonId: slot.pokemonId,
        shiny: slot.shiny,
        shinyEnabled: slot.shinyEnabled,
      })),
    };

    try {
      const teamRes = await fetch(`${API_URL}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamPayload),
      });

      if (!teamRes.ok) {
        const errData = await teamRes.json();
        console.error('[Teams] Failed to save team:', errData);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Teams] Failed to save team:', err);
      return false;
    }
  }

  // Handle confirm team and mark as ready
  async function handleConfirmAndReady() {
    if (!user || currentTeam.length < 6) return;

    const saved = await saveTeam();
    if (!saved) return;

    const playerId = user.id;

    try {
      const readyRes = await fetch(`${API_URL}/rooms/${roomId}/team-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odiserId: playerId }),
      });

      if (!readyRes.ok) {
        const errData = await readyRes.json();
        console.error('[Teams] Failed to mark team ready:', errData);
        return;
      }

      setIsTeamReady(true);
    } catch (err) {
      console.error('[Teams] Failed to mark team ready:', err);
    }
  }

  // Handle cancel team ready
  async function handleCancelTeamReady() {
    if (!user) return;

    const playerId = user.id;

    try {
      await fetch(`${API_URL}/rooms/${roomId}/team-ready`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odiserId: playerId }),
      });
      setIsTeamReady(false);
    } catch (err) {
      console.error('[Teams] Failed to cancel team ready:', err);
    }
  }

  // Listen for BATTLE_STARTED to navigate and TEAM_READY to detect rival ready status
  useBattleSocket({
    roomCode: roomId ?? '',
    playerId: user?.id ?? '',
    onMessage: msg => {
      if (msg.type === 'BATTLE_STARTED') {
        // Fallback: if WS arrives before POST response, still navigate
        if (msg.battle) {
          sessionStorage.setItem(`battle_${roomId}`, JSON.stringify(msg.battle));
        }
        navigate(`/battle/${roomId}`);
      }
      if (msg.type === 'BOTH_TEAMS_READY') {
        console.log('[Teams] Both teams ready, starting battle...');
        fetch(`${API_URL}/battle/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: roomId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error) {
              console.error('[Teams] Battle start error:', data.error);
              return;
            }
            // Store battle state in sessionStorage for battle.tsx
            if (data.battle) {
              sessionStorage.setItem(`battle_${roomId}`, JSON.stringify(data.battle));
            }
            // Navigate immediately using response
            navigate(`/battle/${roomId}`);
          })
          .catch(err => console.error('[Teams] Failed to start battle:', err));
      }
      if (msg.type === 'TEAM_READY' && msg.odiserId !== user?.id) {
        fetch(`${API_URL}/rooms/${roomId}`)
          .then(r => r.json())
          .then(data => {
            const rivalIsReady = data.players?.some((p: any) => p.odiserId !== user?.id && p.teamReady);
            if (rivalIsReady) {
              console.log('[Teams] Rival is team ready!');
            }
          })
          .catch(console.error);
      }
    },
  });

  if (!isSignedIn && roomMode === 'ranked') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-headline text-headline-md text-primary">Please sign in first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body overflow-hidden">
      <div className="crt-overlay" />

      {/* Header */}
      <header className="bg-surface-container-lowest border-b-3 border-black bg-gradient-to-b from-surface-container-highest to-surface-container flex justify-between items-center w-full px-4 h-16 fixed top-0 z-50">
        <div className="font-headline text-headline-lg text-primary tracking-tighter uppercase">Team Builder</div>
        {isPremium && (
          <button
            onClick={() => setShowRetro(!showRetro)}
            className={`
              flex items-center gap-2 px-4 py-2 border-3 border-black chamfer-tl font-label-lg uppercase
              transition-all hover:scale-105 active:scale-95 ml-4
              ${showRetro
                ? 'bg-red-900/30 text-red-500 border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                : 'bg-transparent text-gray-500 border-gray-500'
              }
            `}
            title={showRetro ? 'Desactivar Retro' : 'Activar Retro'}
            aria-label={showRetro ? 'Desactivar Retro' : 'Activar Retro'}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              star
            </span>
            RETRO
          </button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <span className="font-label-lg text-label-lg text-on-surface-variant uppercase">SLOTS: {currentTeam.length}/6</span>
          <span className="material-symbols-outlined text-primary">battery_charging_full</span>
        </div>
      </header>

      <div className="pt-16 flex h-screen">
        {/* Left: Current Team */}
        <aside className="w-80 bg-surface-container border-r-4 border-black p-4 overflow-y-auto hidden md:block flex flex-col">
          <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            Current Team
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {currentTeam.map((slot, i) => (
              <div
                key={i}
                className="aspect-square bg-surface-container-high border-3 border-primary p-2 flex flex-col items-center justify-center chamfer-tl relative"
              >
                <button
                  onClick={() => removePokemon(i)}
                  className="absolute top-1 left-1 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors text-sm font-bold z-10"
                  aria-label="Remove"
                >
                  ×
                </button>
                {isPremium && (
                  <button
                    onClick={() => toggleShiny(slot.pokemonId)}
                    className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      slot.shinyEnabled
                        ? 'bg-yellow-500 text-black'
                        : 'bg-surface-container-lowest text-gray-500 hover:bg-yellow-500/50'
                    }`}
                    aria-label={slot.shinyEnabled ? 'Disable shiny' : 'Enable shiny'}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </button>
                )}
                <div className="w-16 h-16 bg-surface flex items-center justify-center">
                  <img
                    src={slot.shinyEnabled && isPremium ? `${API_URL}/pokemon/sprite/${slot.pokemonId}?shiny=true` : getFrontSprite(slot.pokemonName)}
                    alt={slot.pokemonName}
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <span className="font-label-sm text-label-sm text-primary mt-1 uppercase truncate w-full text-center">{slot.pokemonName}</span>
              </div>
            ))}
            {[...Array(6 - currentTeam.length)].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square bg-surface-container-lowest border-2 border-dashed border-outline-variant chamfer-tl flex items-center justify-center">
                <span className="material-symbols-outlined text-outline-variant text-4xl">add_circle</span>
              </div>
            ))}
          </div>

          <button
            onClick={clearTeam}
            className="w-full bg-surface border-3 border-black p-3 font-label-lg uppercase hover:bg-error hover:text-white transition-colors chamfer-tl mb-3"
          >
            CLEAR TEAM
          </button>

          <div className="mt-auto space-y-2">
            <button
              onClick={() => navigate('/home')}
              className="w-full bg-surface text-on-surface border-3 border-black px-6 py-3 font-headline text-headline-md chamfer-tl hover:bg-surface-variant transition-colors"
            >
              CANCEL
            </button>

            {/* Team confirm/cancel button */}
            {currentTeam.length === 0 ? (
              <button
                disabled
                className="w-full bg-surface text-on-surface border-3 border-black px-8 py-3 font-headline text-headline-md chamfer-br opacity-50 uppercase"
              >
                CONFIRM TEAM
              </button>
            ) : isTeamReady ? (
              <button
                onClick={handleCancelTeamReady}
                className="w-full bg-error text-white border-3 border-black px-8 py-3 font-headline text-headline-md chamfer-br hover:bg-red-700 active:scale-95 transition-all uppercase"
              >
                CANCELAR
              </button>
            ) : (
              <button
                onClick={handleConfirmAndReady}
                disabled={currentTeam.length < 6}
                className="w-full bg-primary text-on-primary border-3 border-black px-8 py-3 font-headline text-headline-md chamfer-br hover:brightness-110 active:scale-95 transition-all uppercase disabled:opacity-50"
              >
                CONFIRM TEAM
              </button>
            )}
          </div>
        </aside>

        {/* Center: Library */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="bg-surface-container-high border-b-3 border-black p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary">search</span>
                <input
                  className="w-full bg-surface-container-lowest border-3 border-black p-3 pl-12 text-primary font-body focus:ring-0 focus:border-primary uppercase chamfer-tl"
                  placeholder="SEARCH POKEMON..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex gap-2">
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
                <button
                  onClick={handleSearch}
                  className="bg-primary text-on-primary px-4 py-2 hover:bg-primary-container transition-colors flex items-center gap-2 font-label-lg uppercase chamfer-br"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                  SEARCH
                </button>
              </div>
            </div>
          </div>

          {/* Pokemon Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {loading && (
                <div className="col-span-full flex justify-center py-12">
                  <div className="pokeball-spin" />
                </div>
              )}
              {pokemonList.map(pokemon => (
                <div
                  key={pokemon._id}
                  onClick={() => handleSelectPokemon(pokemon)}
                  className={`bg-surface-container border-3 border-black p-2 hover:border-primary cursor-pointer group transition-all chamfer-tl ${
                    currentTeam.some(t => t.pokemonId === pokemon.pokedexId) ? 'border-primary bg-surface-container-high' : ''
                  } ${pokemon.isLegendary ? 'relative' : ''}`}
                >
                  {pokemon.isLegendary && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-yellow-500/80 rounded-full flex items-center justify-center z-10">
                      <span className="text-xs">★</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-label-sm font-label-sm text-on-surface-variant">#{String(pokemon.pokedexId).padStart(3, '0')}</span>
                  </div>
                  <img
                    src={showRetro && isPremium ? `${API_URL}/pokemon/sprite/${pokemon.pokedexId}?shiny=true` : getFrontSprite(pokemon.name)}
                    alt={pokemon.name}
                    className="w-full aspect-square object-contain grayscale group-hover:grayscale-0 transition-all"
                    onError={e => { (e.target as HTMLImageElement).src = pokemon.spriteUrl; }}
                  />
                  <div className="mt-2 text-center">
                    <div className="font-label-lg text-label-lg text-on-surface uppercase font-bold truncate">{pokemon.name}</div>
                    <div className="flex justify-center gap-1 mt-1">
                      {pokemon.types.map(t => (
                        <span key={t} className={`type-${t.toLowerCase()} text-[8px] px-1 py-0.5 border border-black uppercase`}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Right: Detail Panel */}
        <aside className="w-80 bg-surface-container-high border-l-4 border-black p-4 overflow-y-auto">
          {selectedPokemon ? (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <div className="inline-block px-4 py-1 bg-surface-container-lowest border-2 border-black mb-2 chamfer-tl">
                  <span className="font-headline text-headline-md text-primary uppercase">{selectedPokemon.name}</span>
                </div>
                <div className="flex justify-center gap-2">
                  {selectedPokemon.types.map(t => (
                    <span key={t} className={`type-${t.toLowerCase()} font-label-lg text-label-lg px-3 py-1 border-2 border-black uppercase`}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-black pb-1">Base Statistics</h3>
                {Object.entries(selectedPokemon.baseStats).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between font-label-sm text-label-sm mb-1 uppercase">
                    <span>{stat.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-primary">{value}</span>
                  </div>
                ))}
              </div>

              {/* Moves preview - show famous moves */}
              <div className="space-y-2">
                <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest border-b border-black pb-1">Featured Moves (Automatic)</h3>
                <div className="text-xs text-on-surface-variant">
                  Moves are selected automatically based on the Pokémon's role
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={() => handleAddToTeam(selectedPokemon)}
                disabled={currentTeam.length >= 6}
                className="w-full mt-6 bg-primary text-on-primary font-bold py-3 border-3 border-black chamfer-br hover:brightness-110 active:scale-95 transition-all uppercase font-label-lg disabled:opacity-50"
              >
                {currentTeam.length >= 6 ? 'TEAM FULL' : 'ADD TO TEAM'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="material-symbols-outlined text-[64px] text-outline-variant mb-4">touch_app</span>
              <p className="font-body text-body-md text-on-surface-variant">Select a Pokemon to view details</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
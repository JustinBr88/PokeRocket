import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useBattleSocket } from '../../lib/useBattleSocket';
import { getFrontSprite, getBackSprite, hpColor } from '../../lib/sprites';
import { playMoveSound } from '../../lib/movesetSounds';
import { useMusicStore } from '../../stores/musicStore';
import { useTeamStore } from '../../stores/teamStore';
import { API_URL } from '../../lib/sprites';
import type { BattleState, PlayerState, BattlePokemon } from '../../types';

export default function BattlePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const playerId = user?.id ?? '';
  const { setBattleContext } = useMusicStore();
  const { toggleShiny } = useTeamStore();

  const [battle, setBattle] = useState<BattleState | null>(null);
  const [roomMode, setRoomMode] = useState<'casual' | 'ranked' | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [animClass, setAnimClass] = useState('');
  const [actionSubmitted, setActionSubmitted] = useState(false);
  const [attackState, setAttackState] = useState<'idle' | 'attacking' | 'damaged' | 'fainted'>('idle');
  const [attackerName, setAttackerName] = useState('');
  const [defenderName, setDefenderName] = useState('');
  const [displayedLog, setDisplayedLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  // Load battle state from sessionStorage (set by teams.tsx) or via GET fallback
  useEffect(() => {
    if (!roomId) return;

    // 1. Try sessionStorage first (set by teams.tsx after POST /battle/start)
    const stored = sessionStorage.getItem(`battle_${roomId}`);
    if (stored) {
      try {
        const battleData = JSON.parse(stored);
        setBattle(battleData);
        sessionStorage.removeItem(`battle_${roomId}`); // Clean up after use
        return;
      } catch (e) {
        console.warn('[Battle] Failed to parse stored battle, trying API...');
      }
    }

    // 2. GET fallback: fetch battle state from API
    fetch(`${API_URL}/battle/${roomId}`)
      .then(r => {
        if (!r.ok) throw new Error('Battle not found');
        return r.json();
      })
      .then(data => {
        setBattle(data);
      })
      .catch(err => {
        console.error('[Battle] Failed to load battle:', err);
      });

    // Also fetch room mode for music context
    fetch(`${API_URL}/rooms/${roomId}`)
      .then(r => r.json())
      .then(data => {
        setRoomMode(data.mode);
        setBattleContext(data.mode as 'casual' | 'ranked', null);
      })
      .catch(console.error);
  }, [roomId, setBattleContext]);

  // Load saved team preferences (shinyEnabled) from DB
  useEffect(() => {
    if (!playerId) return;
    fetch(`${API_URL}/teams/${playerId}`)
      .then(r => r.json())
      .then(data => {
        if (data.pokemons) {
          for (const pokemon of data.pokemons) {
            if (pokemon.shinyEnabled) {
              toggleShiny(pokemon.pokemonId);
            }
          }
        }
      })
      .catch(err => console.debug('[Battle] Could not load team preferences:', err));
  }, [playerId, toggleShiny]);

  function handleMessage(msg: any) {
    switch (msg.type) {
      case 'BATTLE_STARTED':
      case 'TURN_RESOLVED': {
        console.log('[Battle] Received:', msg.type, 'turn:', msg.battle?.turn);
        setBattle(msg.battle);
        // Parse attack animation from battle log
        if (msg.type === 'TURN_RESOLVED') {
          const log = msg.battle.battleLog;
          const attackLine = log[log.length - 1];
          const damageLine = log[log.length - 2];

          if (attackLine?.includes('used')) {
            const match = attackLine.match(/^(\w+) used (.+)!/);
            if (match) {
              const attackerName = match[1];
              const moveName = match[2];
              
              setAttackerName(attackerName);
              setAttackState('attacking');

              // Reproducir sonido de ataque
              if (moveName) {
                playMoveSound(moveName, 0.7).catch(error => {
                  console.debug('Could not play attack sound:', moveName, error);
                });
              }

              // After attack animation, show damage
              setTimeout(() => {
                setAttackState('damaged');
                // Parse defender from damage line
                if (damageLine?.includes('took')) {
                  const dmgMatch = damageLine.match(/^(\w+) took/);
                  if (dmgMatch) setDefenderName(dmgMatch[1]);
                }

                // After damage animation, reset
                setTimeout(() => {
                  setAttackState('idle');
                  setDefenderName('');
                }, 500);
              }, 400);
            }
          }

          // Check for faint
          if (log[log.length - 1]?.includes('fainted')) {
            setAttackState('fainted');
          }
        }
        break;
      }
      case 'BATTLE_ENDED':
        setWinner(msg.winnerUserId);
        navigate(`/results/${roomId}`);
        break;
    }
  }

  const { connected } = useBattleSocket({ roomCode: roomId ?? '', playerId, onMessage: handleMessage });

  async function submitMove(moveId: string) {
    if (!roomId || !playerId || actionSubmitted) return;
    setActionSubmitted(true);
    const res = await fetch(`${API_URL}/battle/${roomId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, type: 'move', moveId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown' }));
      console.error('[Battle] submitMove error:', res.status, err);
      // Re-enable on error so player can try again
      setActionSubmitted(false);
    }
  }

  async function submitSwitch(pokemonId: string) {
    if (!roomId || !playerId || actionSubmitted) return;
    setActionSubmitted(true);
    await fetch(`${API_URL}/battle/${roomId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, type: 'switch', pokemonId }),
    });
  }

  async function submitHeal() {
    if (!roomId || !playerId || actionSubmitted) return;
    setActionSubmitted(true);
    await fetch(`${API_URL}/battle/${roomId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, type: 'heal' }),
    });
  }

  // Reset actionSubmitted when turn changes
  useEffect(() => {
    if (battle?.turn) {
      setActionSubmitted(false);
    }
  }, [battle?.turn]);

  // Sequential battle log animation
  useEffect(() => {
    if (!battle?.battleLog) return;
    const newEntries = battle.battleLog.slice(displayedLog.length);
    if (newEntries.length > 0) {
      let delay = 0;
      for (const entry of newEntries) {
        setTimeout(() => {
          setDisplayedLog(prev => [...prev, entry]);
        }, delay);
        delay += 600;
      }
    }
  }, [battle?.battleLog]);

  // Scroll to bottom when new log entry added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [displayedLog]);

  if (!isSignedIn && roomMode === 'ranked') {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p>Please sign in</p></div>;
  }

  const myPlayer = battle?.players.find((p: PlayerState) => p.odiserId === playerId);
  const otherPlayer = battle?.players.find((p: PlayerState) => p.odiserId !== playerId);
  const myActive = myPlayer?.team[myPlayer.activePokemonIdx];
  const otherActive = otherPlayer?.team[otherPlayer.activePokemonIdx];

  // Compute sprite animation class
  const getSpriteClass = (pokemonName: string, isPlayer: boolean) => {
    const base = isPlayer ? 'anim-enter-player' : 'anim-enter-opponent';
    if (attackState === 'idle') return animClass || base;
    if (attackerName === pokemonName && attackState === 'attacking') return 'anim-attack';
    if (defenderName === pokemonName && attackState === 'damaged') return 'anim-damage';
    if (attackState === 'fainted' && defenderName === pokemonName) return 'anim-faint';
    return base;
  };

  // Get sprite URL considering shinyEnabled preference
  const getActiveSpriteUrl = (pokemon: BattlePokemon, isPlayer: boolean) => {
    const teamMember = useTeamStore.getState().currentTeam.find(p => p.pokemonId === Number(pokemon.pokemonId));
    const isShinyEnabled = teamMember?.shinyEnabled ?? false;
    const isPremium = user && (user.publicMetadata?.isPremium === true || user.unsafeMetadata?.isPremium === true);
    
    if (isShinyEnabled && isPremium) {
      // Try to get shiny sprite from PokeAPI
      return `${API_URL}/pokemon/sprite/${pokemon.pokemonId}?shiny=true`;
    }
    
    // Use normal sprite
    return isPlayer ? getBackSprite(pokemon.name) : getFrontSprite(pokemon.name);
  };

  if (!battle) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="crt-overlay" />
        <div className="pokeball-spin mb-8" />
        <p className="font-headline text-headline-md text-primary">LOADING BATTLE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body overflow-hidden flex flex-col">
      <div className="crt-overlay" />

      {/* Header - compact h-10 */}
      <header className="flex justify-between items-center w-full px-4 h-10 bg-surface-container-lowest border-b-3 border-black z-50">
        <div className="font-headline text-headline-sm text-primary tracking-tighter">PokéRocket</div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary' : 'bg-error'}`} />
          <span className="font-label-md text-label-md text-on-surface-variant">TURN {battle.turn}</span>
        </div>
      </header>

      {/* Battle Arena */}
      <div className="flex-grow relative bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] bg-fixed overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#131313] via-surface-container to-surface-container-high opacity-80" />

        {/* Opponent Info (Top Right) */}
        {otherActive && (
          <div className="absolute top-2 right-2 md:top-4 md:right-8 w-56 md:w-72 z-20">
            <div className="bg-surface-container-highest border-3 border-black p-2 md:p-3 chamfer-tl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-end mb-1">
                <span className="font-headline text-label-lg md:text-headline-sm text-on-surface uppercase tracking-tighter truncate">{otherActive.name}</span>
                <span className="font-label-md text-primary">Lv. 50</span>
              </div>
              {/* HP Bar with CSS transition */}
              <div className="relative h-2 md:h-3 bg-surface border-2 border-black w-full overflow-hidden rounded-sm">
                <div
                  className={`absolute top-0 left-0 h-full ${hpColor(otherActive.currentHp / otherActive.maxHp)}`}
                  style={{
                    width: `${(otherActive.currentHp / otherActive.maxHp) * 100}%`,
                    transition: 'width 0.6s ease-out, background-color 0.3s ease'
                  }}
                />
              </div>
              <div className="flex justify-end mt-1">
                <span className="font-label-sm text-primary uppercase text-[10px] md:text-xs">
                  {otherActive.status ? `${otherActive.status.toUpperCase()} (${otherActive.statusTurns})` : 'STATUS: NORMAL'}
                </span>
              </div>
            </div>
            {/* Opponent Sprite */}
            <div className="mt-1 md:mt-2 flex justify-end">
              <img
                src={getActiveSpriteUrl(otherActive, false)}
                alt={otherActive.name}
                className={`w-20 h-20 md:w-32 md:h-32 drop-shadow-[0_0_10px_rgba(147,229,105,0.3)] ${getSpriteClass(otherActive.name, false)}`}
                onError={e => { (e.target as HTMLImageElement).src = otherActive.spriteUrl; }}
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        )}

        {/* Player Info (Bottom Left) */}
        {myActive && (
          <div className="absolute bottom-2 left-2 md:bottom-4 md:left-8 w-56 md:w-72 z-20">
            {/* Player Sprite Back */}
            <div className="mb-1 md:mb-2 flex justify-start">
              <img
                src={getActiveSpriteUrl(myActive, true)}
                alt={myActive.name}
                className={`w-20 h-20 md:w-36 md:h-36 drop-shadow-[0_0_10px_rgba(147,229,105,0.2)] ${getSpriteClass(myActive.name, true)}`}
                onError={e => { (e.target as HTMLImageElement).src = myActive.spriteUrl; }}
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="bg-surface-container-highest border-3 border-black p-2 md:p-3 chamfer-br shadow-[-4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-end mb-1">
                <span className="font-headline text-label-lg md:text-headline-sm text-on-surface uppercase tracking-tighter truncate">{myActive.name}</span>
                <span className="font-label-md text-primary">Lv. 50</span>
              </div>
              {/* HP Bar with CSS transition */}
              <div className="relative h-2 md:h-3 bg-surface border-2 border-black w-full overflow-hidden rounded-sm">
                <div
                  className={`absolute top-0 left-0 h-full ${hpColor(myActive.currentHp / myActive.maxHp)}`}
                  style={{
                    width: `${(myActive.currentHp / myActive.maxHp) * 100}%`,
                    transition: 'width 0.6s ease-out, background-color 0.3s ease'
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="font-label-sm text-on-surface text-[10px] md:text-xs">{myActive.currentHp} / {myActive.maxHp}</span>
                <span className="font-label-sm text-on-surface-variant text-[10px] md:text-xs">
                  {myActive.status ? `${myActive.status.toUpperCase()} (${myActive.statusTurns})` : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Battle Log - single line, compact */}
      <div className="h-8 bg-surface-container-lowest border-t-2 border-black px-2 md:px-4 flex items-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <div className="flex-grow font-body text-body-sm text-on-surface uppercase tracking-wider truncate">
          {displayedLog.slice(-1).map((entry, i) => (
            <p key={i} className="animate-[fadeIn_0.3s_ease-out] truncate">{entry}</p>
          ))}
        </div>
      </div>

      {/* Move Buttons + Actions - compact height */}
      <div className="h-auto bg-surface-container border-t-2 border-black grid grid-cols-12 p-1 md:p-2 gap-1 md:gap-2">
        {/* Move Buttons - col-span-9 */}
        <div className="col-span-12 md:col-span-9 grid grid-cols-2 gap-1">
          {(myActive?.moves || []).slice(0, 4).map((move: any, i: number) => (
            <button
              key={i}
              onClick={() => submitMove(move.moveId)}
              disabled={actionSubmitted}
              className={`group relative bg-surface-container-high border-2 border-black chamfer-tl hover:bg-primary-container transition-all active:scale-95 flex flex-col justify-between p-1.5 md:p-2 ${
                actionSubmitted ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ '--type-bg': `var(--type-${move.type.toLowerCase()})` } as React.CSSProperties}
            >
              <div className="flex justify-between w-full items-center">
                <span className="font-label-md md:text-label-lg text-on-surface group-hover:text-on-primary-container uppercase truncate text-[10px] md:text-xs">{move.name}</span>
                <span className={`type-${move.type.toLowerCase()} px-1 py-0.5 text-white font-label-sm border border-black text-[8px] md:text-[10px]`}>{move.type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between w-full font-label-sm text-on-surface-variant group-hover:text-on-primary-container text-[8px] md:text-[10px]">
                <span>PWR {move.power ?? '—'}</span>
                <span>{move.damageClass.toUpperCase()}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Action Buttons - col-span-3 */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-1">
          {/* SWITCH button - opens modal */}
          <button
            onClick={() => {
              if (!myPlayer || actionSubmitted) return;
              setShowSwitchModal(true);
            }}
            disabled={actionSubmitted || !myPlayer?.team.some((p, i) => i !== myPlayer.activePokemonIdx && p.currentHp > 0)}
            className={`bg-surface-container-high border-2 border-black chamfer-tl hover:bg-secondary-container transition-all active:scale-95 p-1.5 md:p-2 flex items-center gap-2 ${
              actionSubmitted ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span className="material-symbols-outlined text-on-surface text-base md:text-lg">swap_horiz</span>
            <div className="flex flex-col items-start">
              <span className="font-label-md text-label-md text-on-surface uppercase leading-none">SWITCH</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">(-turno)</span>
            </div>
          </button>

          {/* HEAL button */}
          <button
            onClick={submitHeal}
            disabled={actionSubmitted}
            className={`bg-surface-container-high border-2 border-black chamfer-tl hover:bg-green-container transition-all active:scale-95 p-1.5 md:p-2 flex items-center gap-2 ${
              actionSubmitted ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span className="material-symbols-outlined text-on-surface text-base md:text-lg">healing</span>
            <div className="flex flex-col items-start">
              <span className="font-label-md text-label-md text-on-surface uppercase leading-none">HEAL</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">+30% HP</span>
            </div>
          </button>

          {/* BAG button - disabled */}
          <button
            disabled
            className="bg-surface-container-lowest border-2 border-black chamfer-tl opacity-50 cursor-not-allowed p-1.5 md:p-2 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-base md:text-lg">backpack</span>
            <div className="flex flex-col items-start">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase leading-none">BAG</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant leading-none">pronto</span>
            </div>
          </button>
        </div>
      </div>

      {/* SWITCH MODAL */}
      {showSwitchModal && myPlayer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container border-4 border-black chamfer-tl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-[slideUp_0.25s_ease-out] w-[90vw] max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-surface-container-highest border-b-4 border-black p-3 flex items-center justify-between">
              <h2 className="font-headline text-headline-md text-primary uppercase tracking-tighter">ELIGE TU POKEMON</h2>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="w-8 h-8 bg-surface flex items-center justify-center border-2 border-black hover:bg-error hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Pokemon Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {myPlayer.team.map((p: BattlePokemon, i: number) => {
                  const isActive = i === myPlayer.activePokemonIdx;
                  const isKO = p.currentHp <= 0;
                  const hpPct = p.currentHp / p.maxHp;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!isActive && !isKO) {
                          submitSwitch(p.pokemonId);
                          setShowSwitchModal(false);
                        }
                      }}
                      disabled={isActive || isKO}
                      className={`relative p-2 border-2 transition-all ${
                        isActive
                          ? 'border-primary bg-surface-container-high opacity-60 cursor-not-allowed'
                          : isKO
                          ? 'border-black bg-[#2a2a2a] opacity-40 cursor-not-allowed'
                          : 'border-black bg-surface-container-high hover:border-secondary hover:bg-surface-container-highest'
                      }`}
                      style={{ imageRendering: 'pixelated' }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center z-10">
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        </div>
                      )}

                      {/* KO overlay */}
                      {isKO && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <span className="font-headline text-headline-sm text-error">KO</span>
                        </div>
                      )}

                      {/* Sprite */}
                      <div className="w-full aspect-square flex items-center justify-center">
                        <img
                          src={getFrontSprite(p.name)}
                          alt={p.name}
                          className="w-16 h-16 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                          onError={e => { (e.target as HTMLImageElement).src = p.spriteUrl; }}
                        />
                      </div>

                      {/* Name */}
                      <div className="text-center mt-1">
                        <span className={`font-label-md text-label-md uppercase truncate w-full block ${
                          isKO ? 'text-on-surface-variant' : 'text-on-surface'
                        }`}>{p.name}</span>
                      </div>

                      {/* HP Bar */}
                      <div className="mt-1">
                        <div className="relative h-2 bg-surface border border-black rounded-sm overflow-hidden">
                          <div
                            className={`absolute top-0 left-0 h-full ${hpColor(hpPct)}`}
                            style={{ width: `${hpPct * 100}%`, transition: 'width 0.3s ease' }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className={`font-label-sm text-[10px] ${isKO ? 'text-error' : 'text-on-surface-variant'}`}>
                            {p.currentHp}/{p.maxHp}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL } from '../../lib/sprites';

type Mode = 'casual' | 'ranked';

export default function PlayPage() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  async function handleFindOrCreateRoom(mode: Mode) {
    // For ranked, require login; for casual, allow without login
    if (mode === 'ranked' && (!isSignedIn || !user)) {
      return;
    }
    setIsLoading(true);

    try {
      const playerId = user?.id ?? 'guest';
      const name = user?.username ?? user?.firstName ?? 'Player';

      // Try to find a waiting room
      const searchRes = await fetch(`${API_URL}/rooms?mode=${mode}&status=waiting`);
      if (!searchRes.ok) {
        console.error('[Play] Failed to search rooms:', searchRes.status);
        setIsLoading(false);
        return;
      }
      const rooms = await searchRes.json();

      if (Array.isArray(rooms) && rooms.length > 0) {
        // Try to join the first available room
        const joinRes = await fetch(`${API_URL}/rooms/${rooms[0].code}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, odiserId: playerId }),
        });

        if (joinRes.ok) {
          const joinData = await joinRes.json();
          if (joinData.code) {
            navigate(`/room/${joinData.code}`);
            return;
          }
        } else {
          console.warn('[Play] Join failed:', joinRes.status, await joinRes.json().catch(() => 'unknown error'));
        }
        // If join failed or no code, fall through to create new room
        console.warn('[Play] Could not join first available room, creating new one');
      }

      // Create a new room
      const createRes = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, odiserId: playerId }),
      });

      if (!createRes.ok) {
        console.error('[Play] Failed to create room:', createRes.status);
        return;
      }

      const createData = await createRes.json();
      if (!createData.code) {
        console.error('[Play] No room code in response:', createData);
        return;
      }

      navigate(`/room/${createData.code}`);
    } catch (err) {
      console.error('[Play] Error finding/creating room:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    setIsLoading(true);

    try {
      const playerId = user?.id ?? 'guest';
      const name = user?.username ?? user?.firstName ?? 'Player';

      const res = await fetch(`${API_URL}/rooms/${joinCode.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, odiserId: playerId }),
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/room/${data.code}`);
      } else {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Play] Join error:', res.status, error);
        alert(error.error || 'Room not found or full');
      }
    } catch (err) {
      console.error('[Play] Error joining room:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="crt-overlay" />

      {/* Header con botón volver */}
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface-variant hover:text-primary uppercase transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">Select Battle Mode</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-2xl w-full">
          {/* Casual */}
           <button
             onClick={() => handleFindOrCreateRoom('casual')}
             disabled={isLoading}
             className="relative group h-40 bg-surface-container border-4 border-black chamfer-both overflow-hidden hover:border-secondary transition-all active:scale-95 disabled:opacity-50"
           >
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary to-transparent" />
            <div className="absolute top-2 right-4 opacity-30">
              <span className="material-symbols-outlined text-[48px] md:text-[64px] text-secondary">sports_esports</span>
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 md:gap-4">
              <span className="font-headline text-headline-md md:text-headline-lg text-on-surface uppercase">Casual</span>
              <span className="font-body text-body-sm text-on-surface-variant text-center px-4 md:px-8">
                Play for fun. No ELO impact.
              </span>
              {isLoading ? (
                <div className="pokeball-spin w-8 h-8" />
              ) : (
                <span className="font-label-lg text-label-lg text-secondary uppercase border-2 border-secondary px-4 py-2 chamfer-tl">FIND MATCH</span>
              )}
            </div>
          </button>

          {/* Ranked - Coming Soon */}
          <button
            disabled
            className="relative group h-40 bg-surface-container border-4 border-black chamfer-both overflow-hidden opacity-60 cursor-not-allowed"
          >
            <div className="absolute top-2 right-4 opacity-30">
              <span className="material-symbols-outlined text-[48px] md:text-[64px] text-outline-variant" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 md:gap-4">
              <span className="font-headline text-headline-md md:text-headline-lg text-on-surface-variant uppercase">Ranked</span>
              <span className="font-body text-body-sm text-on-surface-variant text-center px-4 md:px-8">
                Próximamente disponible
              </span>
              <span className="font-label-lg text-label-lg text-on-surface-variant uppercase border-2 border-outline-variant px-4 py-2 chamfer-tl">PRÓXIMAMENTE</span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-4 md:my-8 w-full max-w-2xl">
          <div className="flex-1 h-px bg-outline" />
          <span className="font-label-lg text-label-lg text-on-surface-variant uppercase">or</span>
          <div className="flex-1 h-px bg-outline" />
        </div>

        {/* Join Room */}
        <div className="bg-surface-container border-4 border-black p-4 md:p-6 chamfer-both w-full max-w-2xl">
          <p className="font-headline text-headline-sm md:text-headline-md text-primary uppercase mb-2 md:mb-4 text-center">Join with Code</p>
          <div className="flex gap-2 md:gap-4">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
              className="flex-1 bg-surface-container-lowest border-3 border-black text-primary font-headline text-headline-sm md:text-headline-md text-center p-2 md:p-4 chamfer-tl uppercase tracking-[0.2em] placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!joinCode.trim() || isLoading}
              className="bg-primary text-on-primary border-3 border-black px-4 md:px-8 py-2 md:py-4 font-headline text-headline-sm md:text-headline-md chamfer-tl hover:bg-primary-container active:scale-95 disabled:opacity-50 transition-all"
            >
              JOIN
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
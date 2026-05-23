import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL, WS_URL } from '../../lib/sprites';
import { useMusicStore } from '../../stores/musicStore';
import { useState, useEffect, useRef } from 'react';

type RematchState = 'idle' | 'waiting' | 'rival_requested';

export default function ResultsPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const playerId = user?.id ?? '';
  const { setBattleContext, battleMode } = useMusicStore();

  const [result, setResult] = useState<any>(null);
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch battle result data
  useEffect(() => {
    if (!roomId) return;
    fetch(`${API_URL}/battle/${roomId}`)
      .then(r => r.json())
      .then(data => {
        setResult(data);

        // Determine victory/defeat
        const isDraw = !data.winnerUserId;
        const isVictory = !isDraw && data.winnerUserId === playerId;
        const resultType = isVictory ? 'victory' : isDraw ? 'draw' : 'defeat';

        // Update music context
        if (battleMode) {
          setBattleContext(battleMode as 'casual' | 'ranked', resultType);
        }
      })
      .catch(console.error);
  }, [roomId, playerId, battleMode, setBattleContext]);

  // 2-minute countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Time's up - navigate to home
          navigate('/home');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  // WebSocket connection for rematch events
  useEffect(() => {
    if (!roomId || !playerId) return;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws/${roomId}/${playerId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'REMATCH_REQUESTED' && msg.odiserId !== playerId) {
            setRematchState('rival_requested');
          }

          if (msg.type === 'REMATCH_CANCELLED' && msg.odiserId !== playerId) {
            setRematchState('idle');
          }

          if (msg.type === 'REMATCH_BOTH_READY') {
            // Reset battle and navigate to teams
            fetch(`${API_URL}/battle/${roomId}/reset`, { method: 'POST' })
              .then(() => navigate(`/teams/${roomId}`))
              .catch(console.error);
          }
        } catch (e) {
          console.error('[Results] WS message error:', e);
        }
      };

      ws.onclose = () => {
        if (wsRef.current) {
          setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, playerId, navigate]);

  // Request rematch
  async function handleRematch() {
    if (rematchState !== 'idle' && rematchState !== 'rival_requested') return;

    try {
      await fetch(`${API_URL}/rooms/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ odiserId: playerId }),
      });
      setRematchState('waiting');
    } catch (err) {
      console.error('[Results] Rematch error:', err);
    }
  }

  // Cancel rematch and go home
  async function handleLeave() {
    if (rematchState === 'waiting') {
      try {
        await fetch(`${API_URL}/rooms/${roomId}/rematch`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ odiserId: playerId }),
        });
      } catch (err) {
        console.error('[Results] Cancel rematch error:', err);
      }
    }
    navigate('/home');
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine result text
  const isDraw = !result?.winnerUserId;
  const isVictory = !isDraw && result?.winnerUserId === playerId;
  const resultText = isVictory ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';

  return (
    <div className="min-h-screen bg-background font-body flex flex-col items-center justify-center p-4 md:p-8">
      <div className="crt-overlay" />
      <div className="relative z-10 max-w-2xl w-full">
        {/* Header with result */}
        <div className="text-center mb-8">
          <h1 className="font-headline text-[48px] md:text-[64px] metallic-text uppercase tracking-tighter">
            {resultText}
          </h1>
          <div className="w-full h-1 bg-primary mt-2 shadow-[0_0_20px_rgba(147,229,105,0.8)]" />
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className="inline-block bg-surface-container border-3 border-black px-4 py-2 chamfer-tl">
            <span className="font-label-lg text-label-lg text-on-surface-variant uppercase">
              TIME LEFT: <span className="text-primary font-bold">{formatTime(timeLeft)}</span>
            </span>
          </div>
        </div>

        {/* Battle Stats */}
        <div className="bg-surface-container border-4 border-black p-6 md:p-8 chamfer-both">
          <h2 className="font-headline text-headline-md text-primary uppercase mb-6 text-center">Battle Results</h2>

          <div className="grid grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-3">
              <h3 className="font-label-lg text-label-lg text-secondary uppercase">Player 1</h3>
              <div className="bg-surface-container-low border-2 border-black p-3 md:p-4">
                <p className="font-headline text-headline-sm md:text-headline-md text-on-surface">TRAINER</p>
                <p className="font-body text-body-md text-on-surface-variant">Turns: {result?.turn ?? '—'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-label-lg text-label-lg text-secondary uppercase">Player 2</h3>
              <div className="bg-surface-container-low border-2 border-black p-3 md:p-4">
                <p className="font-headline text-headline-sm md:text-headline-md text-on-surface">OPPONENT</p>
                <p className="font-body text-body-md text-on-surface-variant">Turns: —</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rematch Section */}
        <div className="mt-6 space-y-4">
          {/* Rematch Status Indicator */}
          {rematchState === 'waiting' && (
            <div className="text-center animate-pulse">
              <div className="inline-block bg-surface-container border-3 border-black px-6 py-3 chamfer-tl">
                <span className="font-label-lg text-label-lg text-primary uppercase">
                  Esperando al rival...
                </span>
              </div>
            </div>
          )}

          {rematchState === 'rival_requested' && (
            <div className="text-center">
              <div className="inline-block bg-secondary-container border-3 border-black px-6 py-3 chamfer-tl">
                <span className="font-label-lg text-label-lg text-secondary uppercase">
                  El rival quiere rematch!
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-center">
            {/* REMATCH Button */}
            {isSignedIn ? (
              <button
                onClick={handleRematch}
                disabled={rematchState === 'waiting'}
                className={`flex-1 border-3 border-black px-6 py-4 font-headline text-headline-sm chamfer-tl transition-all ${
                  rematchState === 'waiting'
                    ? 'bg-surface-container-low opacity-50 cursor-not-allowed'
                    : rematchState === 'rival_requested'
                    ? 'bg-primary text-on-primary hover:bg-primary-container active:scale-95'
                    : 'bg-primary text-on-primary hover:bg-primary-container active:scale-95'
                }`}
              >
                {rematchState === 'waiting' ? 'ESPERANDO...' : 'REMATCH'}
              </button>
            ) : (
              <button
                disabled
                className="flex-1 bg-surface-container-low border-3 border-black px-6 py-4 font-headline text-headline-sm text-on-surface-variant opacity-50 cursor-not-allowed chamfer-tl"
              >
                REMATCH (LOGIN REQUIRED)
              </button>
            )}

            {/* PLAY AGAIN Button */}
            <button
              onClick={() => navigate('/play')}
              className="flex-1 bg-secondary-container border-3 border-black px-6 py-4 font-headline text-headline-sm text-on-secondary-container chamfer-tl hover:bg-secondary active:scale-95 transition-all"
            >
              PLAY AGAIN
            </button>
          </div>

          {/* Leave Button */}
          <div className="flex justify-center mt-2">
            <button
              onClick={handleLeave}
              className="bg-surface-container border-3 border-black px-6 py-3 font-headline text-label-lg chamfer-tl hover:bg-surface-variant transition-colors"
            >
              LEAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

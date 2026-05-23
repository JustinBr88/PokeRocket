import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL } from '../../lib/sprites';

interface BattleHistoryEntry {
  roomCode: string;
  players: { name: string }[];
  winnerUserId: string;
  turnCount: number;
  mode: 'casual' | 'ranked';
  createdAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ResultBadge({ isWin }: { isWin: boolean }) {
  return (
    <span
      className={`font-headline text-label-sm px-3 py-1 chamfer-sm ${
        isWin
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      {isWin ? 'VICTORY' : 'DEFEAT'}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="font-body text-body-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">
      {mode.toUpperCase()}
    </span>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const [history, setHistory] = useState<BattleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/battle/history/${user.id}`);
        if (!res.ok) throw new Error('Failed to load history');
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        console.error('[History] fetch error:', err);
        setError('Could not load battle history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isSignedIn, user?.id]);

  const getOpponentName = (players: { name: string }[], myOdiserId: string) => {
    const opponent = players.find(p => p.name !== myOdiserId);
    return opponent?.name || 'Unknown';
  };

  const didIWin = (winnerUserId: string) => {
    return winnerUserId === user?.id;
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="crt-overlay" />
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4 sticky top-0 z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface-variant hover:text-primary uppercase transition-colors"
          aria-label="Volver a home"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">Battle History</h1>
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto pb-8 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="pokeball-spin" />
          </div>
        ) : error ? (
          <div className="bg-surface-container border-4 border-black chamfer-both p-6 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">error</span>
            <p className="font-body text-body-md text-on-surface-variant">{error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-surface-container border-4 border-black chamfer-both p-6">
            <p className="font-body text-body-md text-on-surface-variant text-center">
              No battles played yet. Start a match to see your history here!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((entry) => {
              const isWin = didIWin(entry.winnerUserId);
              const opponent = getOpponentName(entry.players, user?.id || '');

              return (
                <div
                  key={entry.roomCode}
                  className="bg-surface-container border-4 border-black chamfer-both p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ResultBadge isWin={isWin} />
                      <ModeBadge mode={entry.mode} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="font-body text-body-sm text-on-surface">
                        <span className="text-on-surface-variant">vs </span>
                        <span className="font-label-md">{opponent}</span>
                      </p>
                      <p className="font-body text-body-xs text-on-surface-variant">
                        Room: <span className="font-mono">{entry.roomCode}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="font-body text-body-xs text-on-surface-variant">
                      {entry.turnCount} turns
                    </span>
                    <span className="font-body text-body-xs text-on-surface-variant">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
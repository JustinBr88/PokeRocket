import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../lib/sprites';

export default function LeaderboardsPage() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder — real leaderboard from backend
    setTimeout(() => setLoading(false), 500);
  }, []);

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="crt-overlay" />
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface-variant hover:text-primary uppercase transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">Leaderboards</h1>
      </header>

      <main className="p-8 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12"><div className="pokeball-spin" /></div>
        ) : (
          <div className="bg-surface-container border-4 border-black chamfer-both p-6">
            <p className="font-body text-body-md text-on-surface-variant text-center">
              Leaderboard data will be available once players start ranking matches.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';

export default function RulesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background font-body flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="crt-overlay" />
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4 sticky top-0 z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface-variant hover:text-primary uppercase transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">Rules</h1>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto pb-8 overflow-y-auto">
        <div className="space-y-6">
          {/* Battle Basics */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">swords</span>
              How Battle Works
            </h2>
            <div className="space-y-3 text-body-md text-on-surface">
              <p>• Each player selects a team of <strong>6 Pokémon</strong> before battle.</p>
              <p>• Battles are <strong>1v1</strong> — only the active Pokémon fights at a time.</p>
              <p>• The goal is to <strong>knock out</strong> all of your opponent's Pokémon.</p>
              <p>• All Pokémon are set to <strong>Level 50</strong> for balanced combat.</p>
              <p>• You can <strong>switch</strong> Pokémon at any time (uses your turn).</p>
            </div>
          </div>

          {/* Damage System */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">analytics</span>
              Damage & Type System
            </h2>
            <div className="space-y-3 text-body-md text-on-surface">
              <p>• Each Pokémon has a <strong>type</strong> (Fire, Water, Grass, etc.).</p>
              <p>• Attacks are <strong>super effective</strong> (2x damage) against weak types.</p>
              <p>• Attacks are <strong>not very effective</strong> (0.5x) against resistant types.</p>
              <p>• Same-type attacks get <strong>STAB</strong> (Same Type Attack Bonus): +50% damage.</p>
              <p>• <strong>Critical hits</strong> land 1 in 24 times for 1.5x damage.</p>
            </div>
          </div>

          {/* Status Conditions */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Status Conditions
            </h2>
            <div className="space-y-3 text-body-md text-on-surface">
              <p>• <strong>Burn</strong>: Lose 6.25% HP per turn, Attack reduced by 50%.</p>
              <p>• <strong>Poison</strong>: Lose 6.25% HP per turn.</p>
              <p>• <strong>Paralysis</strong>: Speed reduced by 50%, may not move.</p>
              <p>• Status clears when you <strong>switch</strong> Pokémon.</p>
              <p>• Some moves can <strong>heal</strong> status conditions.</p>
            </div>
          </div>

          {/* Game Modes */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">sports_esports</span>
              Game Modes
            </h2>
            <div className="space-y-4">
              <div className="bg-surface-container-high border-2 border-black p-4">
                <h3 className="font-headline text-headline-md text-secondary uppercase mb-2">Casual</h3>
                <p className="text-body-md text-on-surface">Play for fun with friends. No ELO impact, no ranked pressure. Perfect for testing team strategies.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-4">
                <h3 className="font-headline text-headline-md text-primary uppercase mb-2">Ranked</h3>
                <p className="text-body-md text-on-surface">Compete for glory! Your wins and losses affect your <strong>ELO rating</strong>. Climb the leaderboard to become the best trainer in Unova.</p>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">person</span>
              Pokémon Roles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-body-md text-on-surface">
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">⚔️ Sweeper</p>
                <p className="text-on-surface-variant text-sm">High damage output. Finishes opponents fast.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">🛡️ Tank</p>
                <p className="text-on-surface-variant text-sm">High HP and Defense. Absorbs damage.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">💚 Support</p>
                <p className="text-on-surface-variant text-sm">Heals and provides utility. Keeps team alive.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">📈 Buffer</p>
                <p className="text-on-surface-variant text-sm">Raises stats to power up team.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">☠️ Status Applier</p>
                <p className="text-on-surface-variant text-sm">Inflicts burns, poisons, paralysis on enemies.</p>
              </div>
              <div className="bg-surface-container-high border-2 border-black p-3">
                <p className="font-headline text-label-lg text-on-surface uppercase">📉 Debuffer</p>
                <p className="text-on-surface-variant text-sm">Lowers enemy stats to weaken them.</p>
              </div>
            </div>
          </div>

          {/* ELO System */}
          <div className="bg-surface-container border-4 border-black p-6 chamfer-both">
            <h2 className="font-headline text-headline-md text-primary uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">emoji_events</span>
              Ranked ELO System
            </h2>
            <div className="space-y-3 text-body-md text-on-surface">
              <p>• Your <strong>ELO rating</strong> starts at <strong>1500</strong>.</p>
              <p>• <strong>Win</strong> → ELO increases based on opponent's rating.</p>
              <p>• <strong>Lose</strong> → ELO decreases based on opponent's rating.</p>
              <p>• Higher ELO means <strong>higher rank</strong> on the leaderboard.</p>
              <p>• The top trainers appear on the <strong>Season Leaderboard</strong>.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
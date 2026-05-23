import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const clerk = useClerk();
  const username = user?.username ?? user?.firstName ?? 'TRAINER';
  const trainerId = user?.id?.slice(-5).toUpperCase() ?? '00000';
  const [isPremium, setIsPremium] = useState(false);
  const [isCheckingPremium, setIsCheckingPremium] = useState(true);

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
        setIsCheckingPremium(false);
      }
    };

    checkPremiumStatus();
  }, [user]);

  return (
    <div className="min-h-screen bg-background hex-pattern overflow-hidden flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface-container-lowest border-b-3 border-black bg-gradient-to-b from-surface-container-highest to-surface-container flex justify-between items-center w-full px-4 h-16 fixed top-0 z-50">
        <div className="font-headline text-headline-lg text-primary tracking-tighter uppercase">
          PokéRocket
        </div>
        <nav className="hidden md:flex gap-6 items-center">
          <a className="font-headline text-headline-md text-on-surface-variant hover:bg-primary hover:text-on-primary px-3 py-1 transition-colors" href="#">Battle</a>
          <a className="font-headline text-headline-md text-on-surface-variant hover:bg-primary hover:text-on-primary px-3 py-1 transition-colors" href="#">Teams</a>
          <a className="font-headline text-headline-md text-on-surface-variant hover:bg-primary hover:text-on-primary px-3 py-1 transition-colors" href="#">Dex</a>
        </nav>
        <div className="flex items-center gap-4 text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>signal_cellular_4_bar</span>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>battery_charging_full</span>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* SideNavBar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 z-40 overflow-y-auto bg-surface-container border-r-4 border-black hidden md:block bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          {/* Trainer Profile */}
          <div className="p-4 border-b-3 border-black bg-surface-container-high flex items-center gap-3">
            <div className="w-12 h-12 bg-surface-container-lowest border-3 border-black overflow-hidden relative">
              {user?.imageUrl ? (
                <img alt="Trainer" className="w-full h-full object-cover" src={user.imageUrl} />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center text-on-primary font-headline">R</div>
              )}
            </div>
            <div>
              <div className="font-headline text-headline-md text-on-surface leading-none uppercase">{username}</div>
              <div className="font-body text-body-md text-on-surface-variant">ID: {trainerId}</div>
            </div>
            <button
              onClick={() => {
                if (isSignedIn) {
                  clerk.signOut();
                } else {
                  navigate('/login');
                }
              }}
              className="ml-auto p-2 hover:bg-surface-variant rounded transition-colors"
              title={isSignedIn ? "Sign out" : "Sign in"}
            >
              <span className="material-symbols-outlined text-on-surface-variant">
                {isSignedIn ? 'logout' : 'login'}
              </span>
            </button>
          </div>

          <nav className="flex flex-col">
            <a className="bg-primary text-on-primary border-l-[6px] border-primary-container p-4 flex items-center gap-3 active:scale-95 duration-75" href="/home">
              <span className="material-symbols-outlined">home</span>
              <span className="font-body text-body-md uppercase">Home</span>
            </a>
            <a className="text-on-surface-variant p-4 flex items-center gap-3 hover:bg-surface-variant transition-colors" href="/pokedex">
              <span className="material-symbols-outlined">menu_book</span>
              <span className="font-body text-body-md uppercase">Pokédex</span>
            </a>
            
            <a className="text-on-surface-variant p-4 flex items-center gap-3 hover:bg-surface-variant transition-colors" href="/history">
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="font-body text-body-md uppercase">History</span>
            </a>
            <a className="text-on-surface-variant p-4 flex items-center gap-3 hover:bg-surface-variant transition-colors" href="/rules">
              <span className="material-symbols-outlined">menu</span>
              <span className="font-body text-body-md uppercase">Rules</span>
            </a>
            <a
              className={`p-4 flex items-center gap-3 transition-colors ${
                isPremium
                  ? 'bg-tertiary text-on-tertiary hover:bg-tertiary-container'
                  : 'text-on-surface-variant hover:bg-surface-variant'
              }`}
              href="/premium"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
              <span className="font-body text-body-md uppercase">
                Premium {isPremium ? '(Active)' : ''}
              </span>
            </a>
          </nav>

          <div className="p-4 mt-auto">
            <button
              onClick={() => navigate('/play')}
              className="w-full bg-on-tertiary-fixed-variant text-white border-3 border-black p-3 font-headline text-headline-md chamfer-both gloss-effect active:translate-y-0.5"
            >
              SEARCH BATTLE
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="md:ml-64 pt-20 pb-24 px-4 md:px-8 flex-1">
          <div className="max-w-4xl mx-auto">
            {/* Mobile Trainer Profile */}
            <div className="md:hidden flex items-center gap-4 bg-surface-container border-3 border-black p-4 mb-6 chamfer-tl">
              <div className="w-16 h-16 bg-surface-container-lowest border-3 border-black overflow-hidden">
                {user?.imageUrl ? (
                  <img alt="Trainer" className="w-full h-full object-cover" src={user.imageUrl} />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-on-primary font-headline">R</div>
                )}
              </div>
              <div>
                <h2 className="font-headline text-headline-md text-primary uppercase">{username}</h2>
                <p className="font-body text-body-md text-on-surface-variant">ID: {trainerId} | RANK: TRAINER</p>
              </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Online Play (Primary Action) */}
              <button
                onClick={() => navigate('/play')}
                className="relative group h-24 bg-on-tertiary-fixed-variant border-4 border-black chamfer-both overflow-hidden flex flex-col justify-end p-3 gloss-effect transition-transform active:scale-95 hover:bg-tertiary-container"
              >
                <div className="absolute top-2 right-4 opacity-20">
                  <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>wifi</span>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-3xl">public</span>
                  <span className="font-headline text-headline-md text-white uppercase tracking-wider">Online Play</span>
                </div>
              </button>

              {/* Battle History */}
              <button
                onClick={() => navigate('/history')}
                className="relative group h-24 bg-surface-container-high border-4 border-black chamfer-both overflow-hidden flex flex-col justify-end p-3 gloss-effect transition-transform active:scale-95 hover:bg-surface-variant"
              >
                <div className="absolute top-2 right-4 opacity-10">
                  <span className="material-symbols-outlined text-[48px]">history_edu</span>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">equalizer</span>
                  <span className="font-headline text-headline-md text-on-surface uppercase">Battle History</span>
                </div>
              </button>

              {/* Team Builder (Large Span) */}
              <button
                onClick={() => navigate('/play')}
                className="relative group h-24 bg-surface-container-high border-4 border-black chamfer-both overflow-hidden flex flex-col justify-end p-3 gloss-effect transition-transform active:scale-95 hover:bg-surface-variant sm:col-span-2"
              >
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary to-transparent" />
                <div className="absolute top-2 right-4 opacity-10">
                  <span className="material-symbols-outlined text-[64px]">handyman</span>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">construction</span>
                  <span className="font-headline text-headline-md text-on-surface uppercase">Team Builder</span>
                </div>
              </button>

              {/* My Teams */}
              <button
                onClick={() => navigate('/history')}
                className="relative group h-24 bg-surface-container-high border-4 border-black chamfer-both overflow-hidden flex flex-col justify-end p-3 gloss-effect transition-transform active:scale-95 hover:bg-surface-variant"
              >
                <div className="absolute top-2 right-4 opacity-10">
                  <span className="material-symbols-outlined text-[48px]">groups</span>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">grid_view</span>
                  <span className="font-headline text-headline-md text-on-surface uppercase">My Teams</span>
                </div>
              </button>

              {/* Leaderboards */}
              <button
                onClick={() => navigate('/leaderboards')}
                className="relative group h-24 bg-surface-container-high border-4 border-black chamfer-both overflow-hidden flex flex-col justify-end p-3 gloss-effect transition-transform active:scale-95 hover:bg-surface-variant"
              >
                <div className="absolute top-2 right-4 opacity-10">
                  <span className="material-symbols-outlined text-[48px]">emoji_events</span>
                </div>
                <div className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-3xl">leaderboard</span>
                  <span className="font-headline text-headline-md text-on-surface uppercase">Leaderboards</span>
                </div>
              </button>
            </div>

            {/* Footer Stats Card */}
            <div className="mt-4 bg-surface-container border-4 border-black p-2 md:p-3 chamfer-both relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#8a9481 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
              <div className="relative flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                  <div className="font-label-lg text-label-lg text-primary uppercase">Current Season</div>
                  <div className="font-headline text-headline-md text-on-surface">SEASON 01: UNOVA</div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-surface-container-lowest border-2 border-black p-2 text-center w-24">
                    <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">WINS</div>
                    <div className="font-headline text-headline-md text-primary">0</div>
                  </div>
                  <div className="bg-surface-container-lowest border-2 border-black p-2 text-center w-24">
                    <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">LOSS</div>
                    <div className="font-headline text-headline-md text-tertiary-container">0</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile BottomNavBar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 gap-2 bg-surface-container-highest border-t-4 border-black rounded-t-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,transparent_50%)]">
        <button className="flex flex-col items-center justify-center text-on-surface-variant p-2 hover:bg-primary-container hover:text-on-primary-container active:scale-90 duration-100">
          <span className="material-symbols-outlined">swords</span>
          <span className="font-label-lg text-label-lg uppercase">Move List</span>
        </button>
        <button className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container border-3 border-black rounded-lg p-2 active:scale-90 duration-100">
          <span className="material-symbols-outlined">cached</span>
          <span className="font-label-lg text-label-lg uppercase">Switch</span>
        </button>
        <button className="flex flex-col items-center justify-center text-on-surface-variant p-2 hover:bg-primary-container hover:text-on-primary-container active:scale-90 duration-100">
          <span className="material-symbols-outlined">local_mall</span>
          <span className="font-label-lg text-label-lg uppercase">Bag</span>
        </button>
        <button className="flex flex-col items-center justify-center text-on-surface-variant p-2 hover:bg-primary-container hover:text-on-primary-container active:scale-90 duration-100">
          <span className="material-symbols-outlined">directions_run</span>
          <span className="font-label-lg text-label-lg uppercase">Run</span>
        </button>
      </nav>
    </div>
  );
}
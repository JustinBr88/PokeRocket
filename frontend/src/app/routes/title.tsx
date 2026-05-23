import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

export default function TitlePage() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useUser();

  function handleStart() {
    navigate('/home');
  }

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-surface-container-lowest border-[12px] border-black">
      {/* Background: Reshiram + Zekrom silhouettes */}
      <div className="absolute inset-0 flex items-center justify-between px-12 pointer-events-none opacity-40">
        <div className="h-full w-1/3 relative">
          <img
            alt="Reshiram"
            className="h-full w-full object-contain object-left scale-110"
            src="https://play.pokemonshowdown.com/sprites/ani-back/reshiram.gif"
          />
        </div>
        <div className="h-full w-1/3 relative">
          <img
            alt="Zekrom"
            className="h-full w-full object-contain object-right scale-110"
            src="https://play.pokemonshowdown.com/sprites/ani/zekrom.gif"
          />
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-2 bg-black px-4 py-2 chamfer-br border-b-3 border-r-3 border-outline">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>signal_cellular_4_bar</span>
          <span className="font-headline text-headline-md text-primary tracking-tighter uppercase">PokéRocket</span>
        </div>
        <div className="flex items-center gap-4 bg-black px-4 py-2 chamfer-tl border-t-3 border-l-3 border-outline">
          <span className="font-label-lg text-label-lg text-on-surface-variant">V 1.0.0 // SYSTEM_ACTIVE</span>
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>battery_charging_full</span>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8">
          <h1 className="font-headline text-[80px] metallic-text uppercase tracking-tighter leading-none text-center">
            PokéRocket
          </h1>
          <div className="w-full h-1 bg-primary mt-2 shadow-[0_0_15px_rgba(147,229,105,0.8)]" />
        </div>

        <div className="flex flex-col items-center gap-12 mt-12">
          <button
            onClick={handleStart}
            className="group relative px-12 py-6 bg-surface-container-high border-[4px] border-black chamfer-tl transition-all hover:translate-y-0.5 active:scale-95 hover:bg-primary-container"
          >
            <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 transition-opacity" />
            <span className="relative font-headline text-headline-md text-on-surface tracking-widest animate-pulse">
              {isLoaded ? (isSignedIn ? 'CONTINUE' : 'CLICK TO START') : 'LOADING...'}
            </span>
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary" />
          </button>

          <div className="flex gap-4">
            <div className="bg-surface-variant border-[2px] border-black px-3 py-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-ping" />
              <span className="font-label-sm text-label-sm text-on-surface uppercase">Server: Unova_West</span>
            </div>
            <div className="bg-surface-variant border-[2px] border-black px-3 py-1 flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-on-surface uppercase">Region: Global</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom left: trainer data */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8 flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-sm border-l-[6px] border-primary p-4 w-64">
            <p className="font-label-lg text-label-lg text-primary mb-1">TRAINER DATA</p>
            <p className="font-body text-body-md text-on-surface">
              {isSignedIn ? 'LINKED: TRAINER' : 'NOT LINKED'}
            </p>
            <p className="font-body text-body-md text-on-surface-variant text-[12px]">00000-PKRK-0000</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button className="bg-surface-container border-[3px] border-black p-4 flex flex-col items-center justify-center hover:bg-primary group transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-primary group-hover:text-on-primary mb-1">settings</span>
            <span className="font-label-sm text-label-sm group-hover:text-on-primary">CONFIG</span>
          </button>
          <button className="bg-surface-container border-[3px] border-black p-4 flex flex-col items-center justify-center hover:bg-primary group transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-primary group-hover:text-on-primary mb-1">history</span>
            <span className="font-label-sm text-label-sm group-hover:text-on-primary">LOGS</span>
          </button>
        </div>
      </div>

      {/* Bottom ticker */}
      <div className="fixed bottom-0 left-0 w-full h-12 bg-surface-container-highest border-t-[4px] border-black flex items-center px-6 overflow-hidden">
        <div className="flex gap-8 animate-[scroll_20s_linear_infinite] whitespace-nowrap">
          <span className="font-label-lg text-label-lg text-on-surface-variant">NEW BATTLE SIMULATION AVAILABLE: CHALLENGE ELITE FOUR</span>
          <span className="font-label-lg text-label-lg text-primary">•</span>
          <span className="font-label-lg text-label-lg text-on-surface-variant">TRADE MARKET UPDATE: SHINY GENESECT DETECTED IN SECTOR 7</span>
          <span className="font-label-lg text-label-lg text-primary">•</span>
          <span className="font-label-lg text-label-lg text-on-surface-variant">SYSTEM CALIBRATION COMPLETE: RESHIRAM ENGINE AT 100%</span>
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
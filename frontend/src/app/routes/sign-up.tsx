import { SignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function SignUpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="crt-overlay" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-headline text-[48px] metallic-text uppercase tracking-tighter">
            PokéRocket
          </h1>
          <div className="w-full h-1 bg-primary mt-2 shadow-[0_0_15px_rgba(147,229,105,0.8)]" />
        </div>

        {/* Clerk SignUp */}
        <div className="bg-surface-container border-[4px] border-black p-8 chamfer-both">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/login"
            afterSignUpUrl="/home"
            afterSignInUrl="/home"
            appearance={{
              variables: {
                colorPrimary: '#93e569',
                colorBackground: '#1b1c1c',
                colorText: '#e4e2e1',
                colorInputBackground: '#0e0e0e',
                colorInputText: '#e4e2e1',
                borderRadius: '0px',
                fontFamily: "'JetBrains Mono', monospace",
              },
              elements: {
                card: 'bg-surface-container border-3 border-black',
                headerTitle: 'font-headline text-headline-md text-primary',
                formButtonPrimary: 'bg-primary text-on-primary font-headline border-3 border-black chamfer-tl hover:bg-primary-container',
              },
            }}
          />
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="font-label-lg text-label-lg text-on-surface-variant hover:text-primary uppercase tracking-wider"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
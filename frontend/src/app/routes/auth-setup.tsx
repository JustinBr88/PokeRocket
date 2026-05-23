import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { API_URL } from '../../lib/sprites';

export default function AuthSetupPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      // No session — go to sign-up
      navigate('/sign-up');
      return;
    }

    // Ensure user exists in MongoDB before going to home
    async function ensureUser() {
      try {
        const res = await fetch(`${API_URL}/auth/ensure-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            odiserId: user.id,
            username: user.username ?? user.firstName ?? 'Player',
            avatarUrl: user.imageUrl ?? '',
            isPremium: user.publicMetadata?.isPremium === true || user.unsafeMetadata?.isPremium === true,
          }),
        });

        if (res.ok) {
          navigate('/home');
        } else {
          // Fallback — go home anyway, the webhook will sync later
          console.error('[AuthSetup] ensure-user failed:', res.status);
          navigate('/home');
        }
      } catch (err) {
        console.error('[AuthSetup] Error:', err);
        navigate('/home');
      }
    }

    ensureUser();
  }, [isLoaded, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="crt-overlay" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="pokeball-spin mb-4" />
        <div className="font-headline text-headline-md text-primary uppercase tracking-tighter">
          SYNCING TRAINER DATA...
        </div>
      </div>
    </div>
  );
}
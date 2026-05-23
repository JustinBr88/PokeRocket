import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { loadStripe, Stripe as StripeType } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useMutation } from '@tanstack/react-query';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let stripePromise: Promise<StripeType | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

interface PremiumCheckoutProps {
  userId: string;
  userEmail: string;
  isPremium: boolean;
  onPremiumActivated: () => void;
}

function PremiumCheckout({
  userId,
  userEmail,
  isPremium,
  onPremiumActivated,
}: PremiumCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const createIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/payments/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed to create payment intent');
      return response.json();
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await fetch(`${API_URL}/payments/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentIntentId }),
      });
      if (!response.ok) throw new Error('Failed to confirm payment');
      return response.json();
    },
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError('Stripe not loaded');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Crear payment intent en backend
      const intentData = await createIntentMutation.mutateAsync();
      const { clientSecret, paymentIntentId } = intentData;

      // 2. Confirmar pago con Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: { email: userEmail },
          },
        });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // 3. Confirmar en backend
        await confirmPaymentMutation.mutateAsync(paymentIntentId);
        onPremiumActivated();
      } else {
        setError('Payment was not successful');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPremium) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="bg-surface-container border-4 border-black p-8 text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-primary mb-4 block">
            verified_user
          </span>
          <h2 className="font-headline text-headline-lg text-primary uppercase mb-4">
            ¡YA TIENES PREMIUM!
          </h2>
          <p className="font-body text-body-md text-on-surface mb-6">
            Disfruta de todas las características exclusivas.
          </p>
          <button
            onClick={() => (window.location.href = '/home')}
            className="bg-primary text-on-primary border-3 border-black px-6 py-2 font-headline uppercase hover:scale-105 transition-transform"
          >
            Volver a Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePayment} className="space-y-6">
      <div className="bg-surface-container-high border-3 border-black p-6">
        <h3 className="font-headline text-headline-md text-on-surface mb-4 uppercase">
          Información de Pago
        </h3>

        <div className="mb-4">
          <label className="font-body text-body-md text-on-surface block mb-2">
            Número de Tarjeta
          </label>
          <div className="border-2 border-black p-3 bg-surface-container">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#000',
                    fontFamily: 'JetBrains Mono, monospace',
                  },
                  invalid: { color: '#d32f2f' },
                },
              }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-500 text-red-700 p-3 mb-4 font-body">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || !stripe}
          className={`w-full bg-on-tertiary-fixed-variant text-white border-3 border-black p-3 font-headline text-headline-md uppercase transition-all ${
            isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
          }`}
        >
          {isProcessing ? 'PROCESANDO...' : 'PAGAR $77.77'}
        </button>
      </div>

      <div className="text-body-sm text-on-surface-variant text-center">
        <p>Pago seguro via Stripe. No guardamos datos de tu tarjeta.</p>
      </div>
    </form>
  );
}

export default function PremiumPage() {
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoadingPremium, setIsLoadingPremium] = useState(true);
  const stripe = getStripePromise();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      navigate('/login');
      return;
    }

    // Verificar estado premium
    const checkPremium = async () => {
      try {
        const response = await fetch(
          `${API_URL}/payments/check-premium/${user!.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsPremium(data.isPremium);
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      } finally {
        setIsLoadingPremium(false);
      }
    };

    checkPremium();
  }, [isLoaded, isSignedIn, user, navigate]);

  if (!isLoaded || isLoadingPremium) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse font-headline text-headline-lg text-primary">
          Cargando...
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background font-body flex flex-col">
      <div className="crt-overlay" />

      {/* Header */}
      <header className="bg-surface-container-lowest border-b-3 border-black p-4 flex items-center gap-4 sticky top-0 z-50">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors p-2"
          aria-label="Volver a home"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline text-headline-lg text-primary uppercase tracking-tighter">
          PREMIUM
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full pb-8">
        {/* Features */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <div className="bg-surface-container border-4 border-black p-4 flex gap-4">
            <span className="material-symbols-outlined text-3xl text-tertiary flex-shrink-0">
              image
            </span>
            <div>
              <h3 className="font-headline text-headline-md text-on-surface uppercase mb-1">
                Sprites Shiny
              </h3>
              <p className="font-body text-body-md text-on-surface-variant">
                Usa versiones shiny animadas de Gen 5 en el Pokédex y batallas
              </p>
            </div>
          </div>

          <div className="bg-surface-container border-4 border-black p-4 flex gap-4">
            <span className="material-symbols-outlined text-3xl text-tertiary flex-shrink-0">
              music_note
            </span>
            <div>
              <h3 className="font-headline text-headline-md text-on-surface uppercase mb-1">
                3 Canciones Exclusivas
              </h3>
              <p className="font-body text-body-md text-on-surface-variant">
                Música premium en las batallas
              </p>
            </div>
          </div>

          <div className="bg-surface-container border-4 border-black p-4 flex gap-4">
            <span className="material-symbols-outlined text-3xl text-tertiary flex-shrink-0">
              verified_user
            </span>
            <div>
              <h3 className="font-headline text-headline-md text-on-surface uppercase mb-1">
                Acceso de por Vida
              </h3>
              <p className="font-body text-body-md text-on-surface-variant">
                Compra única, beneficios permanentes
              </p>
            </div>
          </div>
        </div>

        {/* Price Card */}
        <div className="bg-surface-container border-4 border-black p-6 mb-8">
          <div className="flex items-baseline justify-center gap-2 mb-6">
            <span className="font-headline text-headline-lg text-primary">$77.77</span>
            <span className="font-body text-body-md text-on-surface-variant">USD</span>
          </div>

          {/* Stripe Elements */}
          {!isPremium ? (
            <Elements stripe={stripe!}>
              <PremiumCheckout
                userId={user!.id}
                userEmail={user!.emailAddresses?.[0]?.emailAddress || user!.id}
                isPremium={isPremium}
                onPremiumActivated={() => {
                  setIsPremium(true);
                  setTimeout(() => navigate('/home'), 2000);
                }}
              />
            </Elements>
          ) : (
            <PremiumCheckout
              userId={user!.id}
              userEmail={user!.emailAddresses?.[0]?.emailAddress || user!.id}
              isPremium={isPremium}
              onPremiumActivated={() => setIsPremium(true)}
            />
          )}
        </div>

        {/* Security Note */}
        <div className="flex gap-2 items-start text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined flex-shrink-0 mt-1">lock</span>
          <p>
            Todos los pagos son procesados de forma segura por Stripe. Nunca compartimos
            información de tu tarjeta.
          </p>
        </div>
      </main>
    </div>
  );
}

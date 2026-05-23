import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { MusicProvider } from './components/MusicProvider';
import './app/index.css';

const queryClient = new QueryClient();

function Root() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_test_placeholder'}>
      <QueryClientProvider client={queryClient}>
        <MusicProvider>
          <div className="crt-overlay" />
          <App />
        </MusicProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>
);
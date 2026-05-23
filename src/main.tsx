import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

// Provide a safe fallback when `VITE_CONVEX_URL` was not provided at build
// time (which results in an empty string). The Convex client requires an
// absolute URL; fall back to the current origin so the app can work when
// served from the same host.
const envUrl = (import.meta.env.VITE_CONVEX_URL ?? '') as string;
const convexBase = envUrl.length > 0 ? envUrl : (typeof window !== 'undefined' ? window.location.origin : '');
const convex = new ConvexReactClient(convexBase);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </ErrorBoundary>
  </StrictMode>,
);

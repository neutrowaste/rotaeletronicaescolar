import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import './index.css';

const App = lazy(() => import('./App'));

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          padding: 24,
          fontFamily: 'Poppins, sans-serif',
          background: '#F0F5F6',
          color: '#0D394F',
          minHeight: '100vh',
        }}>
          <h1 style={{ color: '#197c63', marginBottom: 16 }}>Erro ao carregar o app</h1>
          <pre style={{
            background: '#FFFFFF',
            border: '1px solid #0d394f',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            color: '#f87171',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Elemento #root não encontrado');

let globalError: string | null = null;

window.addEventListener('error', (e) => {
  globalError = e.message ?? String(e.error);
  // Não substituir o DOM do React (innerHTML) para evitar erro removeChild em cascata
  console.error('Erro capturado:', globalError, e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  if (!globalError) {
    globalError = e.reason?.message ?? String(e.reason);
    console.error('Unhandled rejection:', globalError, e.reason);
  }
});

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <Suspense fallback={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#F0F5F6',
            color: '#0d394f',
            fontFamily: 'Poppins, sans-serif',
          }}>
            Carregando...
          </div>
        }>
          <App />
        </Suspense>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

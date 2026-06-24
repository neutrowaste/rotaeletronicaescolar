import { useEffect, useLayoutEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Restaura token/usuário do localStorage antes de decidir redirecionar.
 * Sem isso, no 1º render isAuthenticated ainda é false → recarregar ou abrir URL
 * direta mandava para /login mesmo com sessão válida.
 */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initFromStorage, syncSessionFromApi } = useAuthStore();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(false);

  useLayoutEffect(() => {
    initFromStorage();
    setSessionChecked(true);
  }, [initFromStorage]);

  useEffect(() => {
    if (!sessionChecked || !isAuthenticated) return;
    void syncSessionFromApi();
  }, [sessionChecked, isAuthenticated, syncSessionFromApi]);

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-urban-bg text-urban-brand font-medium">
        Carregando…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

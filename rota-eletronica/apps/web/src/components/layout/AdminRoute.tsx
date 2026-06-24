import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole } from '@/utils/permissoes';

/** Rotas exclusivas de perfil ADMIN (ex.: matriz de permissões por perfil). */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminRole(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

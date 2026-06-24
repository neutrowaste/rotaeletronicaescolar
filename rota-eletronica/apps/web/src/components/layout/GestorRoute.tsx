import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { podeAcessarModuloUsuarios } from '@/utils/permissoes';

/** Módulo Usuários: ADMIN ou GESTOR com permissão de visualizar (OPERADOR não acessa). */
export function GestorRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!podeAcessarModuloUsuarios(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

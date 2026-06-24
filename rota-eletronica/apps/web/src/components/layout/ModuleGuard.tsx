import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { pode } from '@/utils/permissoes';
import type { AcaoPermissao, ModuloPermissao } from '@rota-eletronica/shared-types';

type Props = {
  modulo: ModuloPermissao;
  acao?: AcaoPermissao;
  children: React.ReactNode;
};

/** Bloqueia rota quando o perfil não tem a ação no módulo (GESTOR/OPERADOR com matriz). */
export function ModuleGuard({ modulo, acao = 'visualizar', children }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!pode(user, modulo, acao)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

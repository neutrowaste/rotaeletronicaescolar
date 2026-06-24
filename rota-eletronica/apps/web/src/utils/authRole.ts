import type { WebUser } from '@rota-eletronica/shared-types';

/** Administrador, gestor ou legado `admin`/`gestor`: menus completos, módulo Usuários, mapa “Brasil”. */
export function isGestorProfile(role: WebUser['role'] | string | undefined): boolean {
  const r = String(role ?? '');
  return r === 'ADMIN' || r === 'GESTOR' || r === 'admin' || r === 'gestor';
}

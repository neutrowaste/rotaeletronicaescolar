import type {
  WebUser,
  ModuloPermissao,
  AcaoPermissao,
  PermissoesUsuario,
} from '@rota-eletronica/shared-types';

export function isAdminRole(role: string | undefined): boolean {
  return String(role ?? '').trim().toUpperCase() === 'ADMIN';
}

/** ADMIN: sempre true. GESTOR/OPERADOR: `permissoes` null = acesso total (legado); senão exige flag true. */
export function pode(
  user: WebUser | null,
  modulo: ModuloPermissao,
  acao: AcaoPermissao
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const r = String(user.role);
  if (r !== 'GESTOR' && r !== 'gestor' && r !== 'OPERADOR' && r !== 'operador') return false;
  const p = user.permissoes as PermissoesUsuario | null | undefined;
  // `null`/ausente = acesso total. `{}` no banco trata como não configurado (evita menu vazio até o 1º save).
  if (p == null) return true;
  if (typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === 0) return true;
  return p[modulo]?.[acao] === true;
}

/** Menu Usuários: só ADMIN ou GESTOR com permissão (OPERADOR nunca). */
export function podeAcessarModuloUsuarios(user: WebUser | null): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const r = String(user.role);
  if (r === 'OPERADOR' || r === 'operador') return false;
  if (r === 'GESTOR' || r === 'gestor') return pode(user, 'usuarios', 'visualizar');
  return false;
}

/**
 * Gestor só pode editar/excluir/redefinir senha de usuários que ele criou (e nunca ADMIN).
 * Administrador: sempre true.
 */
export function gestorPodeGerenciarLinhaUsuario(
  user: WebUser | null,
  row: { perfil: string; criadoPorUsuarioId?: string | null }
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const r = String(user.role).toUpperCase();
  if (r !== 'GESTOR') return false;
  if (row.perfil === 'ADMIN') return false;
  return row.criadoPorUsuarioId === user.id;
}

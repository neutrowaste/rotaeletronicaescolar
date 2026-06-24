import { Prisma } from '../../node_modules/.prisma/api-client/index.js';

/** Espelha `packages/shared-types` MODULO_PERMISSAO_VALUES / ACAO_PERMISSAO_VALUES */
export const MODULOS_PERMISSAO = [
  'dashboard',
  'usuarios',
  'municipios',
  'escolas',
  'garagens',
  'veiculos',
  'motoristas',
  'roteirizacao',
  'escalas',
  'alunos',
  'mapa',
  'permissoes',
] as const;

export const ACOES_PERMISSAO = ['visualizar', 'criar', 'editar', 'excluir'] as const;

/** Setores de unidade — cada um pode ter matriz própria em `perfil_permissoes.permissoes`. */
export const SETORES_USUARIO = ['SETOR_TRANSPORTE', 'SETOR_MAPAS', 'SETOR_EDUCACAO'] as const;
export type SetorUsuarioKey = (typeof SETORES_USUARIO)[number];

export type ModuloPermissaoKey = (typeof MODULOS_PERMISSAO)[number];
export type AcaoPermissaoKey = (typeof ACOES_PERMISSAO)[number];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Objeto armazenado com chaves SETOR_* (matriz por setor). */
export function isNestedBySetor(o: Record<string, unknown>): boolean {
  return SETORES_USUARIO.some((s) => Object.prototype.hasOwnProperty.call(o, s));
}

/** Formato legado: chaves = módulos (dashboard, mapa, …). */
export function isLegacyFlatPermissoes(o: Record<string, unknown>): boolean {
  return MODULOS_PERMISSAO.some((m) => Object.prototype.hasOwnProperty.call(o, m));
}

function modulosForPerfil(perfil: string): ModuloPermissaoKey[] {
  const all = [...MODULOS_PERMISSAO];
  if (perfil === 'OPERADOR') return all.filter((x) => x !== 'usuarios') as ModuloPermissaoKey[];
  return all as ModuloPermissaoKey[];
}

/** Matriz explícita “tudo falso” (sessão não pode cair em `{}` → null → acesso total no front). */
export function denyAllMatrixForPerfil(perfil: string): Record<string, Record<string, boolean>> {
  const mods = modulosForPerfil(perfil);
  const out: Record<string, Record<string, boolean>> = {};
  for (const mod of mods) {
    const row: Record<string, boolean> = {};
    for (const ac of ACOES_PERMISSAO) row[ac] = false;
    out[mod] = row;
  }
  return out;
}

/**
 * A partir do JSON do banco (legado plano ou por setor), devolve a matriz **plana** do módulo/ação
 * para o setor do usuário (sessão / JWT). Legado: devolve o objeto como está.
 */
export function effectivePermissoesForSession(
  raw: unknown,
  setorUnidade: string | null,
  perfil: string
): unknown {
  if (raw == null) return null;
  if (!isRecord(raw)) return null;
  if (!isNestedBySetor(raw)) {
    return raw;
  }
  if (perfil !== 'GESTOR' && perfil !== 'OPERADOR') return null;
  const setor = setorUnidade as SetorUsuarioKey | null;
  if (!setor || !SETORES_USUARIO.includes(setor)) {
    return denyAllMatrixForPerfil(perfil);
  }
  const block = raw[setor];
  if (!isRecord(block)) {
    return denyAllMatrixForPerfil(perfil);
  }
  if (Object.keys(block).length === 0) {
    return denyAllMatrixForPerfil(perfil);
  }
  return block;
}

function parseOneModuleRow(block: Record<string, unknown>, mod: ModuloPermissaoKey): Record<string, boolean> | null {
  const row: Record<string, boolean> = {};
  for (const ac of ACOES_PERMISSAO) {
    if (block[ac] === true) row[ac] = true;
    else if (block[ac] === false) row[ac] = false;
  }
  return Object.keys(row).length ? row : null;
}

/** Extrai matriz plana módulo → ações a partir de um objeto fonte. */
function parseFlatModuleMatrix(src: Record<string, unknown>): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const mod of MODULOS_PERMISSAO) {
    const block = src[mod];
    if (block === undefined) continue;
    if (!isRecord(block)) throw new Error(`permissoes.${mod} inválidas`);
    const row = parseOneModuleRow(block, mod);
    if (row) out[mod] = row;
  }
  return out;
}

/**
 * Valida e normaliza JSON vindo do cliente.
 * `null` = sem restrição (coluna SQL NULL).
 * Aceita formato legado (plano) ou por setor: `{ SETOR_TRANSPORTE: { mapa: { visualizar: true } } }`.
 */
export function parsePermissoesInput(
  raw: unknown
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (raw === null || raw === undefined) return Prisma.DbNull;
  if (!isRecord(raw)) throw new Error('permissoes inválidas');

  if (isNestedBySetor(raw)) {
    const out: Record<string, Record<string, Record<string, boolean>>> = {};
    for (const setor of SETORES_USUARIO) {
      const inner = raw[setor];
      if (inner === undefined) continue;
      if (!isRecord(inner)) throw new Error(`permissoes.${setor} inválidas`);
      const flat = parseFlatModuleMatrix(inner);
      if (Object.keys(flat).length > 0) out[setor] = flat;
    }
    return (Object.keys(out).length ? out : {}) as Prisma.InputJsonValue;
  }

  if (isLegacyFlatPermissoes(raw)) {
    const flat = parseFlatModuleMatrix(raw);
    return (Object.keys(flat).length ? flat : {}) as Prisma.InputJsonValue;
  }

  throw new Error('permissoes inválidas: use matriz legada por módulo ou objeto por setor (SETOR_TRANSPORTE, …)');
}

/** Resposta API: objeto tipado ou null. Objeto vazio = mesmo que null (acesso total / matriz ainda não usada). */
export function permissoesFromDb(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (Object.keys(o).length === 0) return null;
  return o;
}

export function perfilUsaPermissoesGranulares(perfil: string): boolean {
  return perfil === 'GESTOR' || perfil === 'OPERADOR';
}

import type { PaginatedResponse } from '@/services/api';

/** Tamanho fixo das listas em tabelas paginadas (cadastros). */
export const TABLE_PAGE_SIZE = 10;

/**
 * Texto do rodapé: primeiro número = linhas na tabela após filtros locais (busca, etc.).
 * Total “ao todo” = retorno paginado da API; com sessão, a API já restringe ao perfil (municípios do usuário).
 */
export function tablePaginationSummary(
  visibleOnPage: number,
  page: number,
  totalPages: number,
  serverTotal: number
): string {
  return `Nesta página: ${visibleOnPage} • Página ${page} de ${totalPages} • ${serverTotal} ao todo`;
}

export function isPaginated<T>(res: unknown): res is PaginatedResponse<T> {
  return (
    res != null &&
    typeof res === 'object' &&
    'data' in res &&
    Array.isArray((res as { data: unknown }).data)
  );
}

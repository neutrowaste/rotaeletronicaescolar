/**
 * Consulta à API oficial de localidades do IBGE para obter o código do município
 * a partir do nome e da UF.
 * @see https://servicodados.ibge.gov.br/api/docs/localidades
 */

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

interface IbgeEstado {
  id: number;
  sigla: string;
  nome: string;
}

interface IbgeMunicipio {
  id: number;
  nome: string;
  'regiao-imediata'?: { nome: string };
  'regiao-intermediaria'?: { nome: string };
  microrregiao?: { nome: string };
  mesorregiao?: { nome: string };
  'regiao-desenvolvimento'?: { nome: string };
}

let estadosCache: IbgeEstado[] | null = null;

/** Remove acentos para comparação (ex.: "São Paulo" -> "sao paulo") */
function normalizeName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Busca o código IBGE (7 dígitos) do município pelo nome e UF.
 * Retorna null se não encontrar ou em caso de erro.
 */
export async function fetchIbgeCodeByNameAndUf(
  municipalityName: string,
  uf: string
): Promise<string | null> {
  const nameTrim = municipalityName.trim();
  if (!nameTrim || !uf) return null;

  try {
    if (!estadosCache) {
      const res = await fetch(`${IBGE_BASE}/estados`);
      if (!res.ok) return null;
      estadosCache = await res.json();
    }
    const cache = estadosCache;
    if (!cache) return null;
    const estado = cache.find((e) => e.sigla === uf);
    if (!estado) return null;

    const res = await fetch(
      `${IBGE_BASE}/estados/${estado.id}/municipios?orderBy=nome`
    );
    if (!res.ok) return null;
    const municipios: IbgeMunicipio[] = await res.json();

    const normalizedSearch = normalizeName(nameTrim);
    const exact = municipios.find(
      (m) => normalizeName(m.nome) === normalizedSearch
    );
    if (exact) return String(exact.id);

    const partial = municipios.find((m) =>
      normalizeName(m.nome).includes(normalizedSearch)
    );
    if (partial) return String(partial.id);

    const startsWith = municipios.find((m) =>
      normalizeName(m.nome).startsWith(normalizedSearch)
    );
    if (startsWith) return String(startsWith.id);

    return null;
  } catch {
    return null;
  }
}

export interface MunicipioIbge {
  id: string;
  nome: string;
}

/**
 * Lista todos os municípios de uma UF para seleção (Estado → Município).
 * Ordenados por nome.
 */
export async function fetchMunicipiosByUf(uf: string): Promise<MunicipioIbge[]> {
  if (!uf || uf.length !== 2) return [];
  try {
    if (!estadosCache) {
      const res = await fetch(`${IBGE_BASE}/estados`);
      if (!res.ok) return [];
      estadosCache = await res.json();
    }
    if (!estadosCache) return [];
    const estado = estadosCache.find((e) => e.sigla === uf);
    if (!estado) return [];
    const res = await fetch(
      `${IBGE_BASE}/estados/${estado.id}/municipios?orderBy=nome`
    );
    if (!res.ok) return [];
    const municipios: IbgeMunicipio[] = await res.json();
    return municipios.map((m) => ({ id: String(m.id), nome: m.nome }));
  } catch {
    return [];
  }
}

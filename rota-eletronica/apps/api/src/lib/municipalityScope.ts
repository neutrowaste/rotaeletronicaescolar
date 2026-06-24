import type { JwtPayload } from '../middleware/auth.js';

/**
 * `null` = sem restrição (ADMIN ou token ausente — compatível com chamadas sem auth).
 * Array (possivelmente vazio) = GESTOR/OPERADOR: apenas esses municípios.
 */
export function getAllowedMunicipalityIds(auth: JwtPayload | undefined): string[] | null {
  if (!auth) return null;
  const role = String(auth.role ?? '').trim().toUpperCase();
  if (role === 'ADMIN') return null;
  const ids = auth.municipioIds?.length
    ? [...new Set(auth.municipioIds)]
    : auth.municipioId
      ? [auth.municipioId]
      : [];
  return ids;
}

/** Modelos com campo `municipalityId` direto (Route, School, Vehicle, Garage, Student, …). */
export function whereMunicipalityScoped(
  queryMunicipalityId: string | undefined,
  auth: JwtPayload | undefined
): Record<string, unknown> {
  const allowed = getAllowedMunicipalityIds(auth);
  if (allowed === null) {
    return queryMunicipalityId ? { municipalityId: queryMunicipalityId } : {};
  }
  if (allowed.length === 0) {
    return { municipalityId: { in: [] } };
  }
  if (queryMunicipalityId) {
    if (!allowed.includes(queryMunicipalityId)) {
      return { municipalityId: { in: [] } };
    }
    return { municipalityId: queryMunicipalityId };
  }
  return { municipalityId: { in: allowed } };
}

/** Listagem da entidade Municipality (`id` = PK). */
export function whereMunicipalityEntityList(stateFilter: string | undefined, auth: JwtPayload | undefined): Record<string, unknown> {
  const allowed = getAllowedMunicipalityIds(auth);
  const state = stateFilter?.trim();
  const stateWhere = state
    ? { state: { equals: state, mode: 'insensitive' as const } }
    : {};
  if (allowed === null) {
    return stateWhere;
  }
  if (allowed.length === 0) {
    return Object.keys(stateWhere).length > 0 ? { AND: [stateWhere, { id: { in: [] } }] } : { id: { in: [] } };
  }
  const idIn = { id: { in: allowed } };
  if (Object.keys(stateWhere).length === 0) return idIn;
  return { AND: [stateWhere, idIn] };
}

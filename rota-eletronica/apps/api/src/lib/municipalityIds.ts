/**
 * Normaliza o campo JSON `municipality_ids` / `municipalityIds` do motorista.
 */
export function parseDriverMunicipalityIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseDriverMunicipalityIds(parsed);
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>);
    return vals.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
  }
  return [];
}

export function driverOverlapsMunicipalities(driverIds: string[], allowed: Set<string>): boolean {
  return driverIds.some((id) => allowed.has(id));
}

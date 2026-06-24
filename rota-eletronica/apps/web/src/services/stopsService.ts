import { normalizeShiftToPeriod, type Coordinates, type Route, type ShiftPeriod } from '@rota-eletronica/shared-types';

export interface StopOption {
  key: string;
  address: string;
  coordinates: Coordinates;
  routeName?: string;
  /** Rota à qual a parada pertence (primeira ocorrência ao deduplicar por coordenadas). */
  routeId?: string;
  /** Número da parada no itinerário da rota (campo `order`), para conferência com o mapa das rotas. */
  itineraryStopOrder?: number;
}

/** Parada com distância em metros em relação ao ponto de referência (casa do aluno) */
export interface StopOptionWithDistance extends StopOption {
  distanceMeters: number;
}

/** Quantidade de opções de parada/rota exibidas no cadastro do aluno (mais próxima → mais distante). */
export const BOARDING_STOP_OPTIONS_LIMIT = 3;

function boardingStopKey(routeId: string | undefined, order: number | undefined, coordinates: Coordinates): string {
  return `${routeId ?? 'route'}_${order ?? 0}_${coordinates.lat.toFixed(5)}_${coordinates.lng.toFixed(5)}`;
}

/** Distância aproximada entre dois pontos em km */
function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371; // raio da Terra em km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/** Distância entre dois pontos em metros (para exibição) */
export function getDistanceMeters(a: Coordinates, b: Coordinates): number {
  return Math.round(distanceKm(a, b) * 1000);
}

/** Formata distância para exibição: "200 metros da casa do aluno" ou "1,2 km da casa do aluno" */
export function formatStopDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} metros da casa do aluno`;
  }
  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km da casa do aluno`;
}

/**
 * Extrai paradas únicas das rotas do município e retorna listas ordenadas:
 * - por proximidade ao endereço do aluno (embarque: onde o ônibus para para pegar)
 * - por proximidade à escola (desembarque: onde o ônibus para para deixar)
 * @param maxBoardingStops - quando informado, retorna no máximo N paradas mais próximas para embarque, com distanceMeters
 * @param schoolId - quando informado, considera apenas rotas cuja escola de destino é a informada (cadastro do aluno)
 * @param studentShift - quando informado, considera apenas rotas desse turno (normalizado: `night` → integral)
 */
export function getStopsInMunicipalitySorted(
  routes: Route[],
  municipalityId: string,
  referenceBoarding: Coordinates | null,
  referenceAlighting: Coordinates | null,
  maxBoardingStops?: number,
  schoolId?: string | null,
  studentShift?: ShiftPeriod | null
): { stopsForBoarding: StopOptionWithDistance[]; stopsForAlighting: StopOption[] } {
  let routesInMun = routes.filter((r) => r.municipalityId === municipalityId);
  if (schoolId) {
    routesInMun = routesInMun.filter((r) => r.schoolId === schoolId);
  }
  if (studentShift) {
    const period = normalizeShiftToPeriod(studentShift);
    routesInMun = routesInMun.filter((r) => normalizeShiftToPeriod(r.shift) === period);
  }
  const allStops = routesInMun.flatMap((r) =>
    (r.stops ?? []).map((s) => ({
      ...s,
      routeName: r.name,
      routeId: r.id,
    }))
  );

  const seenCoords = new Map<string, StopOption>();
  for (const stop of allStops) {
    const coordKey = `${stop.coordinates.lat.toFixed(5)}_${stop.coordinates.lng.toFixed(5)}`;
    if (!seenCoords.has(coordKey)) {
      seenCoords.set(coordKey, {
        key: coordKey,
        address: stop.address,
        coordinates: stop.coordinates,
        routeName: stop.routeName,
        routeId: stop.routeId,
        itineraryStopOrder: stop.order,
      });
    }
  }
  const uniqueByCoords = Array.from(seenCoords.values());

  const seenBoarding = new Map<string, StopOption>();
  for (const stop of allStops) {
    const key = boardingStopKey(stop.routeId, stop.order, stop.coordinates);
    if (!seenBoarding.has(key)) {
      seenBoarding.set(key, {
        key,
        address: stop.address,
        coordinates: stop.coordinates,
        routeName: stop.routeName,
        routeId: stop.routeId,
        itineraryStopOrder: stop.order,
      });
    }
  }
  const boardingCandidates = Array.from(seenBoarding.values());

  const refB = referenceBoarding ?? referenceAlighting ?? { lat: 0, lng: 0 };
  const refA = referenceAlighting ?? referenceBoarding ?? { lat: 0, lng: 0 };

  let stopsForBoarding: StopOptionWithDistance[] = boardingCandidates.map((s) => ({
    ...s,
    distanceMeters: Math.round(distanceKm(s.coordinates, refB) * 1000),
  }));
  stopsForBoarding.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const boardingLimit =
    maxBoardingStops != null && maxBoardingStops > 0
      ? maxBoardingStops
      : BOARDING_STOP_OPTIONS_LIMIT;
  stopsForBoarding = stopsForBoarding.slice(0, boardingLimit);

  const stopsForAlighting = [...uniqueByCoords].sort(
    (a, b) => distanceKm(a.coordinates, refA) - distanceKm(b.coordinates, refA)
  );

  return { stopsForBoarding, stopsForAlighting };
}

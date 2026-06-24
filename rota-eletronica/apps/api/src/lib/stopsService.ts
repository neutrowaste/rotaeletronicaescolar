import {
  normalizeShiftToPeriod,
  type Coordinates,
  type Route,
  type ShiftPeriod,
} from '@rota-eletronica/shared-types';

export interface StopOption {
  key: string;
  address: string;
  coordinates: Coordinates;
  routeName?: string;
  routeId?: string;
  itineraryStopOrder?: number;
}

export interface StopOptionWithDistance extends StopOption {
  distanceMeters: number;
}

export const BOARDING_STOP_OPTIONS_LIMIT = 3;

function boardingStopKey(
  routeId: string | undefined,
  order: number | undefined,
  coordinates: Coordinates
): string {
  return `${routeId ?? 'route'}_${order ?? 0}_${coordinates.lat.toFixed(5)}_${coordinates.lng.toFixed(5)}`;
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

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

  return { stopsForBoarding, stopsForAlighting: [] };
}

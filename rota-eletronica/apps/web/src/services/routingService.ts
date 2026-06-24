/**
 * Integração com Google Routes API (computeRoutes) para ônibus escolar.
 *
 * Modelagem recomendada:
 * - origin: garagem, escola ou ponto inicial da rota
 * - destination: escola, garagem ou último ponto
 * - intermediates: embarques e desembarques (pontos em que o ônibus para)
 * - vehicleStopover: true nos waypoints intermediários para parada real (pickup/drop-off)
 *
 * Referência: https://routes.googleapis.com/directions/v2:computeRoutes
 * Waypoint: https://developers.google.com/maps/documentation/routes/reference/rest/v2/Waypoint
 */

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const FIELD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimizedIntermediateWaypointIndex';

export interface LatLngLiteral {
  latitude: number;
  longitude: number;
}

/** Waypoint no formato da API (location + vehicleStopover para paradas reais) */
export interface RouteWaypoint {
  location: { latLng: LatLngLiteral };
  vehicleStopover?: boolean;
  via?: boolean;
}

export interface ComputeRouteParams {
  /** Origem: garagem, escola ou ponto inicial */
  origin: LatLngLiteral;
  /** Destino: escola, garagem ou último ponto */
  destination: LatLngLiteral;
  /** Paradas intermediárias (embarque/desembarque); use vehicleStopover: true */
  intermediates: RouteWaypoint[];
  /** Data/hora de partida para tráfego (opcional) */
  departureTime?: Date;
}

/** Opções para computeRoute: ordem dos waypoints e preferência de roteamento */
export interface ComputeRouteOptions {
  /** Otimizar ordem das paradas (true) ou manter ordem informada (false) */
  optimizeWaypointOrder?: boolean;
  /** TRAFFIC_AWARE = mais rápido (tempo); TRAFFIC_UNAWARE = tende a menor distância */
  routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_UNAWARE';
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface ComputeRouteResult {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  /** Índices (0-based) dos waypoints na ordem otimizada (optimizedIntermediateWaypointIndex) */
  optimizedOrder: number[];
  legs?: RouteLeg[];
}

/** Opção de rota com rótulo para exibição no modal (ex.: "Mais rápido", "Vias principais") */
export interface RouteOption {
  label: string;
  result: ComputeRouteResult;
}

function latLngToApi(lat: number, lng: number): LatLngLiteral {
  return { latitude: lat, longitude: lng };
}

/**
 * Chama a API computeRoutes com origin, destination e intermediates (vehicleStopover: true).
 * Retorna a polyline codificada para desenhar a rota sobre vias no mapa.
 * @param options.optimizeWaypointOrder true = otimizar ordem (padrão); false = manter ordem do usuário
 * @param options.routingPreference TRAFFIC_AWARE = mais rápido (padrão); TRAFFIC_UNAWARE = tende a menor distância
 */
export async function computeRoute(
  params: ComputeRouteParams,
  options: ComputeRouteOptions = {}
): Promise<ComputeRouteResult | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDQ6bE-mNRKpvMJeZWIz6eyLt5uXH7sJzc';
  const optimizeWaypointOrder = options.optimizeWaypointOrder ?? true;
  const routingPreference = options.routingPreference ?? 'TRAFFIC_AWARE';

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: params.origin.latitude,
          longitude: params.origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: params.destination.latitude,
          longitude: params.destination.longitude,
        },
      },
    },
    intermediates: params.intermediates.map((w) => ({
      location: {
        latLng: {
          latitude: w.location.latLng.latitude,
          longitude: w.location.latLng.longitude,
        },
      },
      vehicleStopover: w.vehicleStopover ?? true,
      via: w.via ?? false,
    })),
    travelMode: 'DRIVE',
    routingPreference,
    computeAlternativeRoutes: false,
    optimizeWaypointOrder,
    languageCode: 'pt-BR',
    units: 'METRIC',
    ...(params.departureTime && {
      departureTime: params.departureTime.toISOString(),
    }),
  };

  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Routes API error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
      optimizedIntermediateWaypointIndex?: number[];
      legs?: Array<{ distanceMeters?: number; duration?: string }>;
    }>;
  };

  const route = data.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;

  const durationSeconds = route.duration
    ? parseDurationToSeconds(route.duration)
    : 0;

  const optimizedOrder = route.optimizedIntermediateWaypointIndex ?? [];
  const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
    distanceMeters: leg.distanceMeters ?? 0,
    durationSeconds: leg.duration ? parseDurationToSeconds(leg.duration) : 0,
  }));

  return {
    encodedPolyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds,
    optimizedOrder,
    legs: legs.length > 0 ? legs : undefined,
  };
}

/** Converte duração no formato "165s" ou "3m30s" para segundos */
function parseDurationToSeconds(duration: string): number {
  let total = 0;
  const sMatch = duration.match(/(\d+)s/);
  const mMatch = duration.match(/(\d+)m/);
  const hMatch = duration.match(/(\d+)h/);
  if (hMatch) total += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) total += parseInt(mMatch[1], 10) * 60;
  if (sMatch) total += parseInt(sMatch[1], 10);
  return total;
}

/**
 * Monta parâmetros para computeRoute a partir do modelo de rota do projeto
 * (origin, stops com coordinates, destination = escola).
 */
export function buildComputeRouteParams(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): ComputeRouteParams {
  return {
    origin: latLngToApi(origin.lat, origin.lng),
    destination: latLngToApi(destination.lat, destination.lng),
    intermediates: stops.map((s) => ({
      location: { latLng: latLngToApi(s.coordinates.lat, s.coordinates.lng) },
      vehicleStopover: true,
    })),
  };
}

const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

declare global {
  interface Window {
    google?: typeof google;
  }
}

/**
 * Usa o DirectionsService do Maps JavaScript API (já carregado com o mapa).
 * Funciona no browser sem CORS; usa a mesma chave do mapa.
 */
/** Converte um resultado de Directions route para ComputeRouteResult */
function directionsRouteToResult(
  _googleMaps: typeof google,
  route: google.maps.DirectionsRoute,
  stops: Array<{ coordinates: { lat: number; lng: number } }>
): ComputeRouteResult | null {
  const path = route.overview_path;
  const isArray = Array.isArray(path);
  const len = path ? (isArray ? path.length : (path as { getLength?: () => number }).getLength?.() ?? 0) : 0;
  if (!path || len < 2) return null;
  const points: { lat: number; lng: number }[] = [];
  for (let i = 0; i < len; i++) {
    const p = isArray ? (path as google.maps.LatLng[])[i] : (path as { getAt?: (i: number) => google.maps.LatLng }).getAt?.(i);
    if (p) {
      const pl = p as unknown as { lat: number | (() => number); lng: number | (() => number) };
      const latVal = typeof pl.lat === 'function' ? pl.lat() : pl.lat;
      const lngVal = typeof pl.lng === 'function' ? pl.lng() : pl.lng;
      points.push({ lat: latVal, lng: lngVal });
    }
  }
  const encoded = points.length >= 2 ? encodePolyline(points) : '';
  if (!encoded) return null;
  const waypointOrder = (route as unknown as { waypoint_order?: number[] }).waypoint_order ?? stops.map((_, i) => i);
  let distanceMeters = 0;
  let durationSeconds = 0;
  (route.legs ?? []).forEach((leg) => {
    distanceMeters += leg.distance?.value ?? 0;
    durationSeconds += leg.duration?.value ?? 0;
  });
  return {
    encodedPolyline: encoded,
    distanceMeters,
    durationSeconds,
    optimizedOrder: waypointOrder,
  };
}

export function computeRouteWithMapsService(
  googleMaps: typeof google,
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number },
  options?: { optimizeWaypoints?: boolean }
): Promise<ComputeRouteResult | null> {
  const optimizeWaypoints = options?.optimizeWaypoints ?? true;
  return new Promise((resolve) => {
    const service = new googleMaps.maps.DirectionsService();
    const waypoints = stops.map((s) => ({
      location: new googleMaps.maps.LatLng(s.coordinates.lat, s.coordinates.lng),
      stopover: true,
    }));
    const request: google.maps.DirectionsRequest = {
      origin: new googleMaps.maps.LatLng(origin.lat, origin.lng),
      destination: new googleMaps.maps.LatLng(destination.lat, destination.lng),
      waypoints,
      optimizeWaypoints,
      travelMode: googleMaps.maps.TravelMode.DRIVING,
    };
    service.route(request, (result, status) => {
      if (status !== googleMaps.maps.DirectionsStatus.OK || !result?.routes?.[0]) {
        resolve(null);
        return;
      }
      const r = directionsRouteToResult(googleMaps, result.routes[0], stops);
      resolve(r);
    });
  });
}

/**
 * Rota na ordem programada pelo usuário (sem reordenar paradas).
 * Tenta DirectionsService (optimizeWaypoints: false), depois fallback REST, depois Routes API.
 */
export async function computeRouteUserOrder(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): Promise<ComputeRouteResult | null> {
  if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
    const r = await computeRouteWithMapsService(window.google, origin, stops, destination, { optimizeWaypoints: false });
    if (r) return r;
  }
  const fallback = await computeRouteWithDirectionsFallbackUserOrder(origin, stops, destination);
  if (fallback) return fallback;
  const params = buildComputeRouteParams(origin, stops, destination);
  return computeRoute(params, { optimizeWaypointOrder: false });
}

/**
 * Retorna até duas opções de rota: primeira = caminho mais rápido, segunda = alternativa (vias principais, menos ruas internas).
 * Usa DirectionsService com provideRouteAlternatives: true.
 */
export function computeTwoRouteOptions(
  googleMaps: typeof google,
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): Promise<RouteOption[]> {
  return new Promise((resolve) => {
    const service = new googleMaps.maps.DirectionsService();
    const waypoints = stops.map((s) => ({
      location: new googleMaps.maps.LatLng(s.coordinates.lat, s.coordinates.lng),
      stopover: true,
    }));
    const request: google.maps.DirectionsRequest = {
      origin: new googleMaps.maps.LatLng(origin.lat, origin.lng),
      destination: new googleMaps.maps.LatLng(destination.lat, destination.lng),
      waypoints,
      optimizeWaypoints: true,
      travelMode: googleMaps.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
    };
    service.route(request, (result, status) => {
      if (status !== googleMaps.maps.DirectionsStatus.OK || !result?.routes?.length) {
        resolve([]);
        return;
      }
      const options: RouteOption[] = [];
      const labels = ['Caminho mais rápido', 'Vias principais (menos ruas internas)'];
      for (let i = 0; i < Math.min(2, result.routes.length); i++) {
        const r = directionsRouteToResult(googleMaps, result.routes[i], stops);
        if (r) options.push({ label: labels[i], result: r });
      }
      // Se a API retornou só uma rota, duplicamos como "Opção 2" para sempre exibir dois botões
      if (options.length === 1) {
        options.push({ label: 'Opção 2 (alternativa)', result: { ...options[0].result } });
      }
      resolve(options);
    });
  });
}

/** Rótulos das opções de otimização no modal */
export const ROUTE_OPTION_LABELS = {
  fastest: 'Caminho mais rápido (menor tempo)',
  userOrder: 'Rota programada (sua ordem)',
} as const;

/**
 * Calcula as opções de rota: (1) mais rápida em tempo, (2) ordem do usuário.
 * Usa Routes API quando possível; fallback para DirectionsService e Directions REST.
 */
export async function computeThreeRouteOptions(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): Promise<RouteOption[]> {
  const params = buildComputeRouteParams(origin, stops, destination);

  const [fastest, userOrder] = await Promise.all([
    (async () => {
      if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
        const r = await computeRouteWithMapsService(window.google, origin, stops, destination, { optimizeWaypoints: true });
        return r;
      }
      const fallback = await computeRouteWithDirectionsFallback(origin, stops, destination);
      if (fallback) return fallback;
      return computeRoute(params, { optimizeWaypointOrder: true, routingPreference: 'TRAFFIC_AWARE' });
    })(),
    computeRouteUserOrder(origin, stops, destination),
  ]);

  const options: RouteOption[] = [];
  if (fastest) options.push({ label: ROUTE_OPTION_LABELS.fastest, result: fastest });
  if (userOrder) options.push({ label: ROUTE_OPTION_LABELS.userOrder, result: userOrder });

  return options;
}

/** Codifica array de pontos no formato Google polyline (para uso com overview_path) */
function encodePolyline(points: { lat: number; lng: number }[]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    result += encodeSigned(lat - prevLat) + encodeSigned(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return result;
}
function encodeSigned(n: number): string {
  let s = n << 1;
  if (n < 0) s = ~s;
  let out = '';
  while (s >= 0x20) {
    out += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
    s >>= 5;
  }
  out += String.fromCharCode(s + 63);
  return out;
}

/**
 * Fallback: usa Directions API (Legacy) via fetch quando a Routes API falha.
 * Retorna polyline codificada, distância, duração e ordem otimizada dos waypoints.
 */
export async function computeRouteWithDirectionsFallback(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): Promise<ComputeRouteResult | null> {
  return computeRouteWithDirectionsFallbackInternal(origin, stops, destination, true);
}

/**
 * Directions API (Legacy) com ordem fixa do usuário (optimize: false).
 */
async function computeRouteWithDirectionsFallbackUserOrder(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number }
): Promise<ComputeRouteResult | null> {
  return computeRouteWithDirectionsFallbackInternal(origin, stops, destination, false);
}

async function computeRouteWithDirectionsFallbackInternal(
  origin: { lat: number; lng: number },
  stops: Array<{ coordinates: { lat: number; lng: number } }>,
  destination: { lat: number; lng: number },
  optimize: boolean
): Promise<ComputeRouteResult | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDQ6bE-mNRKpvMJeZWIz6eyLt5uXH7sJzc';
  const waypointsStr = optimize
    ? 'optimize:true|' + stops.map((s) => `${s.coordinates.lat},${s.coordinates.lng}`).join('|')
    : stops.map((s) => `${s.coordinates.lat},${s.coordinates.lng}`).join('|');
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    waypoints: waypointsStr,
    key: apiKey,
    language: 'pt-BR',
    units: 'metric',
  });
  const res = await fetch(`${DIRECTIONS_API_URL}?${params.toString()}`);
  const data = (await res.json()) as {
    routes?: Array<{
      overview_polyline?: { points?: string };
      waypoint_order?: number[];
      legs?: Array<{ distance?: { value: number }; duration?: { value: number } }>;
    }>;
    status?: string;
    error_message?: string;
  };
  if (data.status !== 'OK' || !data.routes?.[0]) {
    if (data.status === 'REQUEST_DENIED' && data.error_message) {
      console.error('Directions API:', data.error_message);
    }
    return null;
  }
  const route = data.routes[0];
  const encodedPolyline = route.overview_polyline?.points;
  if (!encodedPolyline) return null;
  const optimizedOrder = route.waypoint_order ?? stops.map((_, i) => i);
  let distanceMeters = 0;
  let durationSeconds = 0;
  (route.legs ?? []).forEach((leg) => {
    distanceMeters += leg.distance?.value ?? 0;
    durationSeconds += leg.duration?.value ?? 0;
  });
  return {
    encodedPolyline,
    distanceMeters,
    durationSeconds,
    optimizedOrder,
  };
}

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useJsApiLoader, GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { decodePolyline } from '@/utils/polylineUtils';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/config/googleMapsLoader';

/** Opções do loader com array mutável de libraries (exigido por useJsApiLoader) */
const MAP_LOADER_OPTIONS = { ...GOOGLE_MAPS_LOADER_OPTIONS, libraries: [...GOOGLE_MAPS_LOADER_OPTIONS.libraries] };

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%', minHeight: '300px' };

/** Velocidade da animação da rota (opção 1, opção 2 e botão Reproduzir no modal) */
const POLYLINE_ANIMATION_STEP_DIVISOR = 90;
const POLYLINE_ANIMATION_INTERVAL_MS = 100;

const ORANGE = '#f97316';
const BLUE = '#3b82f6';

/** Ícone (G) ou (E) com animação de pulse: G = laranja, E = azul */
function pulseIconDataUrl(letter: 'G' | 'E'): string {
  const color = letter === 'G' ? ORANGE : BLUE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="${color}" stroke="#fff" stroke-width="2">
    <animate attributeName="opacity" values="0.85;1;0.85" dur="1.2s" repeatCount="indefinite"/>
  </circle>
  <text x="20" y="26" text-anchor="middle" fill="#fff" font-weight="bold" font-size="16" font-family="sans-serif">${letter}</text>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export interface RouteCreateMapProps {
  /** Origem (garagem) */
  origin: { lat: number; lng: number } | null;
  /** Destino (escola) */
  destination: { lat: number; lng: number } | null;
  /** Paradas intermediárias em ordem de execução */
  stops: Array<{ id: string; order: number; coordinates: { lat: number; lng: number }; address?: string }>;
  /** Polyline codificada da rota (após otimização) */
  encodedPolyline?: string | null;
  /** Centro do município selecionado: mapa direciona e dá zoom ao escolher município */
  municipalityCenter?: { lat: number; lng: number } | null;
  /** Município pré-selecionado: limita a pesquisa de endereço (Geocoding/Places) a este município */
  municipalityForBounds?: { name: string; state: string } | null;
  /** Índice do item da lista destacado (ao clicar) */
  highlightedIndex?: number | null;
  /** Clique em um ponto da lista (marcador) */
  onStopClick?: (index: number) => void;
  /** Clique no mapa para adicionar parada (só ativo quando usuário clicou em Adicionar parada) */
  onMapClick?: (lat: number, lng: number, address?: string) => void;
  /** Animação da rota (revelar trajeto progressivamente); útil no modal de confirmação */
  animatePolyline?: boolean;
  /** Exibir campo de busca de endereço (ocultar no mapa embed do modal) */
  showSearch?: boolean;
}

export function RouteCreateMap({
  origin,
  destination,
  stops,
  encodedPolyline,
  municipalityCenter,
  municipalityForBounds = null,
  highlightedIndex,
  onStopClick,
  onMapClick,
  animatePolyline = false,
  showSearch = true,
}: RouteCreateMapProps) {
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [autocompleteBounds, setAutocompleteBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [animatedPathLength, setAnimatedPathLength] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mapRefRef = useRef<google.maps.Map | null>(null);
  const isMountedRef = useRef(true);
  const { isLoaded, loadError } = useJsApiLoader(MAP_LOADER_OPTIONS);

  useEffect(() => {
    mapRefRef.current = mapRef;
  }, [mapRef]);

  useEffect(() => {
    if (
      !municipalityForBounds ||
      !isLoaded ||
      typeof google === 'undefined' ||
      typeof google.maps?.Geocoder !== 'function'
    ) {
      setAutocompleteBounds(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    const address = `${municipalityForBounds.name}, ${municipalityForBounds.state}, Brasil`;
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.viewport && isMountedRef.current) {
        setAutocompleteBounds(results[0].geometry.viewport);
      } else {
        setAutocompleteBounds(null);
      }
    });
  }, [municipalityForBounds?.name, municipalityForBounds?.state, isLoaded]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setMapRef(null);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      setMapReady(false);
      return;
    }
    const t = setTimeout(() => setMapReady(true), 100);
    return () => {
      clearTimeout(t);
      setMapReady(false);
    };
  }, [isLoaded]);

  const boundsPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (origin) pts.push(origin);
    stops.forEach((s) => pts.push(s.coordinates));
    if (destination) pts.push(destination);
    return pts;
  }, [origin, destination, stops]);

  const polylinePath = useMemo(() => {
    const encoded = encodedPolyline?.trim();
    if (!encoded) return [];
    try {
      const d = decodePolyline(encoded);
      return d.length >= 2 ? d.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })) : [];
    } catch {
      return [];
    }
  }, [encodedPolyline]);

  useEffect(() => {
    if (!mapRef || !isMountedRef.current) return;
    try {
      if (boundsPoints.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        boundsPoints.forEach((p) => bounds.extend(p));
        mapRef.fitBounds(bounds, { top: 100, right: 80, bottom: 80, left: 80 });
        const z = mapRef.getZoom();
        if (typeof z === 'number' && z > 16) mapRef.setZoom(16);
      } else if (polylinePath.length >= 2) {
        const bounds = new google.maps.LatLngBounds();
        polylinePath.forEach((p) => bounds.extend(p));
        mapRef.fitBounds(bounds, { top: 100, right: 80, bottom: 80, left: 80 });
      } else if (municipalityCenter) {
        mapRef.panTo(municipalityCenter);
        mapRef.setZoom(12);
      }
    } catch {
      // mapa desmontado
    }
  }, [mapRef, boundsPoints, municipalityCenter, polylinePath]);

  useEffect(() => {
    if (!animatePolyline || polylinePath.length < 2) {
      setAnimatedPathLength(polylinePath.length);
      return;
    }
    setAnimatedPathLength(0);
    const total = polylinePath.length;
    const step = Math.max(1, Math.ceil(total / POLYLINE_ANIMATION_STEP_DIVISOR));
    const id = setInterval(() => {
      setAnimatedPathLength((prev) => Math.min(prev + step, total));
    }, POLYLINE_ANIMATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [animatePolyline, encodedPolyline, polylinePath.length]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
  }, []);

  // Pesquisa de endereço: mesmo da página Mapa — PlaceAutocompleteElement no topo centralizado (visual padrão Google Maps)
  const placeAutocompleteRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!showSearch || !isLoaded || !mapRef || !searchContainerRef.current || typeof google === 'undefined') return;
    const container = searchContainerRef.current;
    if (container.querySelector('gmp-place-autocomplete')) return;

    (async () => {
      try {
        container.innerHTML = '';
        const places = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary & { PlaceAutocompleteElement: new (opts?: object) => HTMLElement & { placeholder: string; locationRestriction?: unknown } };
        const placeAutocomplete = new places.PlaceAutocompleteElement({});
        placeAutocomplete.placeholder = 'Pesquisar no Google Maps';
        if (autocompleteBounds) {
          placeAutocomplete.locationRestriction = autocompleteBounds;
        }
        placeAutocomplete.style.width = '480px';
        placeAutocomplete.style.maxWidth = '90vw';

        const handler = async (e: unknown) => {
          const ev = e as { placePrediction?: { toPlace: () => { fetchFields: (opts: { fields: string[] }) => Promise<void> } }; place?: { fetchFields: (opts: { fields: string[] }) => Promise<void>; location?: { lat: () => number; lng: () => number } } };
          const map = mapRefRef.current;
          if (!map || !isMountedRef.current) return;
          const place = ev.place ?? ev.placePrediction?.toPlace?.();
          if (!place) return;
          try {
            await place.fetchFields({ fields: ['location'] });
            const pl = place as unknown as { location?: { lat: () => number; lng: () => number } };
            if (pl?.location) {
              map.panTo({ lat: pl.location.lat(), lng: pl.location.lng() });
              map.setZoom(15);
            }
          } catch {
            // ignore
          }
        };
        placeAutocomplete.addEventListener('gmp-select', handler as EventListener);
        placeAutocompleteRef.current = placeAutocomplete;
        container.appendChild(placeAutocomplete as unknown as Node);
      } catch (err) {
        console.warn('Places API (New) autocomplete init failed:', err);
      }
    })();

    return () => {
      const el = placeAutocompleteRef.current;
      const c = searchContainerRef.current;
      placeAutocompleteRef.current = null;
      if (c && el && c.contains(el as unknown as Node)) {
        try {
          c.removeChild(el as unknown as Node);
        } catch {
          c.innerHTML = '';
        }
      }
    };
  }, [showSearch, isLoaded, mapRef, autocompleteBounds]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const latLng = e.latLng;
      if (!latLng || !onMapClick) return;
      const lat = latLng.lat();
      const lng = latLng.lng();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng }, language: 'pt-BR' },
        (results, status) => {
          const address = status === 'OK' && results?.[0] ? results[0].formatted_address : undefined;
          onMapClick(lat, lng, address ?? '');
        }
      );
    },
    [onMapClick]
  );

  const defaultCenter = useMemo(() => {
    if (origin) return origin;
    if (stops.length > 0) return stops[0].coordinates;
    if (destination) return destination;
    if (municipalityCenter) return municipalityCenter;
    return { lat: -23.5505, lng: -46.6333 };
  }, [origin, destination, stops, municipalityCenter]);

  if (loadError) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-card bg-sidebar/80 border border-urban-petrol/30 flex items-center justify-center text-urban-gray-data text-sm">
        Erro ao carregar o mapa.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-card bg-sidebar/80 border border-urban-petrol/30 flex items-center justify-center text-urban-green text-sm">
        Carregando mapa...
      </div>
    );
  }

  if (!mapReady) {
    return (
      <div className="w-full h-full min-h-[300px] rounded-card bg-sidebar/80 border border-urban-petrol/30 flex items-center justify-center text-urban-green text-sm">
        Preparando mapa...
      </div>
    );
  }

  const pathToRender = animatePolyline && polylinePath.length >= 2
    ? polylinePath.slice(0, Math.max(2, animatedPathLength))
    : polylinePath;

  return (
    <div className="w-full h-full rounded-card overflow-hidden border border-urban-petrol/30 relative" style={{ minHeight: '300px' }}>
      {showSearch && (
        <div
          ref={searchContainerRef}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex justify-center"
          style={{ width: '480px', maxWidth: '90vw' }}
        />
      )}
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={defaultCenter}
        zoom={12}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{
          zoomControl: true,
          mapTypeControl: true,
          fullscreenControl: true,
          draggableCursor: onMapClick ? 'crosshair' : undefined,
        }}
        mapContainerClassName="route-create-map-container"
      >
        {origin && (
          <Marker
            position={origin}
            title="Garagem (origem)"
            icon={{
              url: pulseIconDataUrl('G'),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
          />
        )}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            position={stop.coordinates}
            title={`Parada ${stop.order}: ${stop.address || ''}`}
            label={{
              text: String(stop.order),
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '12px',
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 22,
              fillColor: highlightedIndex === index ? '#1e9470' : '#ef4444',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => onStopClick?.(index)}
          />
        ))}
        {destination && (
          <Marker
            position={destination}
            title="Escola (destino)"
            icon={{
              url: pulseIconDataUrl('E'),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
          />
        )}
        {pathToRender.length >= 2 && (
          <Polyline
            path={pathToRender}
            options={{
              strokeColor: '#197c63',
              strokeWeight: 5,
              strokeOpacity: 0.9,
              geodesic: true,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

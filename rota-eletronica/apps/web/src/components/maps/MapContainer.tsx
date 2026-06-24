import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  useJsApiLoader,
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline,
} from '@react-google-maps/api';
import type { Route, School, Vehicle } from '@rota-eletronica/shared-types';
import { useDriversStore } from '@/store/driversStore';
import { decodePolyline } from '@/utils/polylineUtils';
import { RouteOnRoadMap } from './RouteOnRoadMap';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/config/googleMapsLoader';

/** Opções do loader com array mutável de libraries (exigido por useJsApiLoader) */
const MAP_LOADER_OPTIONS = { ...GOOGLE_MAPS_LOADER_OPTIONS, libraries: [...GOOGLE_MAPS_LOADER_OPTIONS.libraries] };

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%', minHeight: '400px' };

/** Bounds do território brasileiro (fallback quando geocode falha ou para aplicação imediata no Chrome) */
const BRAZIL_BOUNDS = {
  north: 5.27,
  south: -33.75,
  east: -34.79,
  west: -73.99,
};

export type MapMarkerType = 'stop' | 'vehicle' | 'school';

export interface MapMarkerInfo {
  type: MapMarkerType;
  stop?: { routeId: string; routeName: string; order: number; address: string; studentsCount: number };
  vehicle?: { vehicleId: string; plate: string; model: string; driverName: string };
  school?: { schoolId: string; name: string; address: string; principal: string };
}

interface MapContainerProps {
  filteredRoutes: Route[];
  filteredSchools: School[];
  vehiclePositions: { vehicle: Vehicle; lat: number; lng: number }[];
  onApplyFilters?: () => void;
  /** Quando true (ex.: tela de detalhe da rota), centraliza o mapa nos pontos da rota e força desenho sobre vias */
  singleRouteMode?: boolean;
  /** Estilo do container do mapa (ex.: altura fixa para embed) */
  mapContainerStyle?: React.CSSProperties;
  /** Exibir campo de busca de endereço (ocultar no mapa embed, ex.: detalhe da escala) */
  showAddressSearch?: boolean;
  /** Quando true, após fitBounds aplica zoom fixo de ~1km (uso: filtro por um município ou usuário com um município) */
  zoomTo1kmWhenSingleMun?: boolean;
  /** Nível de zoom para escala ~1km (ex.: 15) */
  zoom1kmLevel?: number;
  /** Quando preenchido, usa Geocoding para centralizar no município, zoom 15 e desenhar viewport de destaque */
  municipalityForGeocode?: { name: string; state: string } | null;
  /** Centro inicial quando não há pontos (ex.: admin = Brasil) */
  defaultCenter?: { lat: number; lng: number };
  /** Zoom inicial quando não há pontos (ex.: admin = 4 para Brasil) */
  defaultZoom?: number;
  /** Estado (UF) para vista inicial centralizada no estado do perfil quando filtro Todos e perfil não-admin (geocode estado + fitBounds viewport) */
  initialStateView?: string | null;
  /** Quando true (admin), centraliza no território do Brasil via geocode + fitBounds (área Brasil no Google Maps) */
  initialBrazilView?: boolean;
}

export function MapContainer({
  filteredRoutes,
  filteredSchools,
  vehiclePositions,
  singleRouteMode = false,
  mapContainerStyle,
  showAddressSearch = true,
  zoomTo1kmWhenSingleMun = false,
  zoom1kmLevel = 15,
  municipalityForGeocode = null,
  defaultCenter: defaultCenterProp,
  defaultZoom: defaultZoomProp,
  initialStateView = null,
  initialBrazilView = false,
}: MapContainerProps) {
  const containerStyle = mapContainerStyle ?? MAP_CONTAINER_STYLE;
  const [selected, setSelected] = useState<{ position: google.maps.LatLngLiteral; info: MapMarkerInfo } | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const mapRefRef = useRef<google.maps.Map | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const placeAutocompleteRef = useRef<HTMLElement | null>(null);
  const getDrivers = useDriversStore((s) => s.getDrivers);
  const drivers = getDrivers();

  const { isLoaded, loadError } = useJsApiLoader(MAP_LOADER_OPTIONS);

  useEffect(() => {
    mapRefRef.current = mapRef;
  }, [mapRef]);

  // Pesquisa de endereço: PlaceAutocompleteElement (visual e cores padrão Google Maps), topo centralizado
  useEffect(() => {
    if (!showAddressSearch || !isLoaded || !mapRef || !searchContainerRef.current || typeof google === 'undefined') return;
    const container = searchContainerRef.current;
    if (container.querySelector('gmp-place-autocomplete')) return;

    (async () => {
      try {
        container.innerHTML = '';
        const places = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary & { PlaceAutocompleteElement: new (opts?: object) => HTMLElement & { placeholder: string; locationRestriction?: unknown } };
        const placeAutocomplete = new places.PlaceAutocompleteElement({});
        placeAutocomplete.placeholder = 'Pesquisar no Google Maps';
        placeAutocomplete.style.width = '480px';
        placeAutocomplete.style.maxWidth = '90vw';

        const handler = async (e: unknown) => {
          const ev = e as { placePrediction?: { toPlace: () => { fetchFields: (opts: { fields: string[] }) => Promise<void> } }; place?: { fetchFields: (opts: { fields: string[] }) => Promise<void>; location?: { lat: () => number; lng: () => number } } };
          const map = mapRefRef.current;
          if (!map) return;
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
  }, [showAddressSearch, isLoaded, mapRef]);

  const stopMarkers = useMemo(() => {
    const out: { position: google.maps.LatLngLiteral; info: MapMarkerInfo }[] = [];
    filteredRoutes.forEach((route) => {
      route.stops.forEach((stop) => {
        out.push({
          position: stop.coordinates,
          info: {
            type: 'stop',
            stop: {
              routeId: route.id,
              routeName: route.name,
              order: stop.order,
              address: stop.address,
              studentsCount: stop.studentsIds.length,
            },
          },
        });
      });
    });
    return out;
  }, [filteredRoutes]);

  const schoolMarkers = useMemo(
    () =>
      filteredSchools.map((s) => ({
        position: s.coordinates,
        info: {
          type: 'school' as const,
          school: {
            schoolId: s.id,
            name: s.name,
            address: s.address,
            principal: s.principal,
          },
        },
      })),
    [filteredSchools]
  );

  const vehicleMarkersData = useMemo(
    () =>
      vehiclePositions.map(({ vehicle, lat, lng }) => {
        const driver = drivers.find((d) => d.id === vehicle.driverResponsible);
        return {
          position: { lat, lng } as google.maps.LatLngLiteral,
          info: {
            type: 'vehicle' as const,
            vehicle: {
              vehicleId: vehicle.id,
              plate: vehicle.plate,
              model: `${vehicle.brand} ${vehicle.model}`,
              driverName: driver?.name ?? '-',
            },
          },
        };
      }),
    [vehiclePositions]
  );

  const polylinePaths = useMemo(() => {
    return filteredRoutes.map((route) => {
      if (route.polyline?.trim()) {
        try {
          const decoded = decodePolyline(route.polyline);
          if (decoded.length >= 2) {
            return decoded.map((p) => ({ lat: p.lat, lng: p.lng }));
          }
        } catch {
          // fallback para pontos em linha reta
        }
      }
      const school = filteredSchools.find((s: { id: string }) => s.id === route.schoolId);
      if (!school) return [];
      return [
        route.origin,
        ...route.stops.map((s) => s.coordinates),
        school.coordinates,
      ] as google.maps.LatLngLiteral[];
    });
  }, [filteredRoutes, filteredSchools]);

  const singleRouteForRoad = useMemo(() => {
    if (filteredRoutes.length !== 1) return null;
    const route = filteredRoutes[0];
    const school = filteredSchools.find((s: { id: string }) => s.id === route.schoolId);
    if (!school) return null;
    return { route, destination: school.coordinates };
  }, [filteredRoutes, filteredSchools]);

  const routeBoundsPoints = useMemo(() => {
    if (!singleRouteMode || !singleRouteForRoad) return [];
    const { route, destination } = singleRouteForRoad;
    return [
      route.origin,
      ...route.stops.map((s) => s.coordinates),
      destination,
    ];
  }, [singleRouteMode, singleRouteForRoad]);

  /** Pontos visíveis para ajustar o mapa quando os filtros mudam (página Mapa, não singleRouteMode) */
  const filterBoundsPoints = useMemo(() => {
    if (singleRouteMode) return [];
    const points: google.maps.LatLngLiteral[] = [];
    filteredRoutes.forEach((route) => {
      points.push(route.origin);
      route.stops.forEach((stop) => points.push(stop.coordinates));
    });
    filteredSchools.forEach((s) => points.push(s.coordinates));
    vehiclePositions.forEach((vp) => points.push({ lat: vp.lat, lng: vp.lng }));
    return points;
  }, [singleRouteMode, filteredRoutes, filteredSchools, vehiclePositions]);

  /** Centro e zoom do mapa: quando initialBrazilView ou sem pontos, usa defaultCenter/defaultZoom; senão usa região dos dados */
  const mapCenter = useMemo((): google.maps.LatLngLiteral => {
    if (singleRouteMode || initialBrazilView || filterBoundsPoints.length === 0) return defaultCenterProp ?? DEFAULT_CENTER;
    if (filterBoundsPoints.length === 1) return filterBoundsPoints[0];
    const n = filterBoundsPoints.length;
    const lat = filterBoundsPoints.reduce((s, p) => s + p.lat, 0) / n;
    const lng = filterBoundsPoints.reduce((s, p) => s + p.lng, 0) / n;
    return { lat, lng };
  }, [singleRouteMode, initialBrazilView, filterBoundsPoints, defaultCenterProp]);

  const mapZoom = useMemo(() => {
    if (singleRouteMode || initialBrazilView || filterBoundsPoints.length === 0) return defaultZoomProp ?? 10;
    return 14;
  }, [singleRouteMode, initialBrazilView, filterBoundsPoints, defaultZoomProp]);

  const onLoadMap = useCallback((map: google.maps.Map) => {
    setMapRef(map);
  }, []);

  useEffect(() => {
    if (!mapRef || !singleRouteMode || routeBoundsPoints.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    routeBoundsPoints.forEach((p) => bounds.extend(p));
    mapRef.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [mapRef, singleRouteMode, routeBoundsPoints]);

  /** Quando há município selecionado para geocode: centraliza e zoom 15 (sem borda de destaque) */
  useEffect(() => {
    if (!mapRef || singleRouteMode || !municipalityForGeocode) return;
    const geocoder = new google.maps.Geocoder();
    const address = `${municipalityForGeocode.name}, ${municipalityForGeocode.state}, Brasil`;
    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results?.[0] || !mapRef) return;
      const loc = results[0].geometry.location;
      mapRef.setCenter(loc);
      mapRef.setZoom(15);
    });
  }, [mapRef, singleRouteMode, municipalityForGeocode]);

  /** Vista inicial área Brasil (admin, filtro Todos): fitBounds no território brasileiro; aplica na hora e no idle (Chrome) */
  useEffect(() => {
    if (!mapRef || singleRouteMode || municipalityForGeocode || !initialBrazilView) return;
    const padding = { top: 60, right: 60, bottom: 60, left: 60 };
    const brazilBounds = new google.maps.LatLngBounds(
      { lat: BRAZIL_BOUNDS.south, lng: BRAZIL_BOUNDS.west },
      { lat: BRAZIL_BOUNDS.north, lng: BRAZIL_BOUNDS.east }
    );
    const apply = () => {
      google.maps.event.trigger(mapRef, 'resize');
      mapRef.fitBounds(brazilBounds, padding);
    };
    apply();
    const listener = mapRef.addListener('idle', () => {
      apply();
      google.maps.event.removeListener(listener);
    });
    return () => {
      try {
        google.maps.event.removeListener(listener);
      } catch {
        //
      }
    };
  }, [mapRef, singleRouteMode, municipalityForGeocode, initialBrazilView]);

  /** Vista inicial centralizada no estado do perfil (não-admin, filtro Todos): geocode + fitBounds no "idle" do mapa */
  useEffect(() => {
    if (!mapRef || singleRouteMode || municipalityForGeocode || filterBoundsPoints.length > 0 || !initialStateView) return;
    const geocoder = new google.maps.Geocoder();
    const address = `${initialStateView}, Brasil`;
    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results?.[0] || !mapRef) return;
      const viewport = results[0].geometry.viewport;
      const padding = { top: 60, right: 60, bottom: 60, left: 60 };
      const applyBounds = () => {
        mapRef.fitBounds(viewport, padding);
      };
      const listener = mapRef.addListener('idle', () => {
        applyBounds();
        google.maps.event.removeListener(listener);
      });
      applyBounds();
    });
  }, [mapRef, singleRouteMode, municipalityForGeocode, filterBoundsPoints.length, initialStateView]);

  useEffect(() => {
    if (!mapRef || singleRouteMode || filterBoundsPoints.length === 0 || municipalityForGeocode || initialBrazilView) return;
    const points = filterBoundsPoints;
    if (points.length === 1) {
      mapRef.setCenter(points[0]);
      mapRef.setZoom(zoom1kmLevel);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    const padding = { top: 80, right: 80, bottom: 80, left: 80 };
    mapRef.fitBounds(bounds, padding);
    if (zoomTo1kmWhenSingleMun) {
      const listener = mapRef.addListener('idle', () => {
        mapRef.setZoom(zoom1kmLevel);
        google.maps.event.removeListener(listener);
      });
      return () => {
        try {
          google.maps.event.removeListener(listener);
        } catch {
          //
        }
      };
    }
  }, [mapRef, singleRouteMode, filterBoundsPoints, zoomTo1kmWhenSingleMun, zoom1kmLevel, municipalityForGeocode, initialBrazilView]);

  /** Vista padrão (centro/zoom): aplica no "idle" do mapa; não roda quando initialBrazilView ou initialStateView */
  useEffect(() => {
    if (!mapRef || singleRouteMode || filterBoundsPoints.length > 0 || municipalityForGeocode || initialStateView || initialBrazilView) return;
    const apply = () => {
      google.maps.event.trigger(mapRef, 'resize');
      mapRef.panTo(mapCenter);
      mapRef.setZoom(mapZoom);
    };
    const listener = mapRef.addListener('idle', () => {
      apply();
      google.maps.event.removeListener(listener);
    });
    apply();
    return () => {
      try {
        google.maps.event.removeListener(listener);
      } catch {
        //
      }
    };
  }, [mapRef, singleRouteMode, filterBoundsPoints.length, mapCenter, mapZoom, municipalityForGeocode, initialStateView, initialBrazilView]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-96 bg-sidebar/80 rounded-card border border-urban-petrol/30 text-urban-gray-data">
        Erro ao carregar o Google Maps. Verifique a chave da API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96 bg-sidebar/80 rounded-card border border-urban-petrol/30 text-urban-green">
        Carregando mapa...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full min-h-[400px] rounded-card overflow-hidden">
      {showAddressSearch && (
        <div
          ref={searchContainerRef}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex justify-center"
          style={{ width: '480px', maxWidth: '90vw' }}
        />
      )}

      <div className="absolute bottom-4 left-4 z-10 flex gap-3 px-3 py-2 rounded-lg bg-urban-bg/90 text-white text-sm shadow-lg">
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" /> Parada</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-urban-green mr-1" /> Veículo</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1" /> Escola</span>
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={onLoadMap}
        options={{
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          scrollwheel: true,
          gestureHandling: 'greedy',
        }}
      >
        {stopMarkers.map((m, i) => (
          <Marker
            key={`stop-${i}`}
            position={m.position}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => setSelected({ position: m.position, info: m.info })}
          />
        ))}
        {schoolMarkers.map((m) => (
          <Marker
            key={m.info.school!.schoolId}
            position={m.position}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => setSelected({ position: m.position, info: m.info })}
          />
        ))}
        {vehicleMarkersData.map((m) => (
          <Marker
            key={m.info.vehicle!.vehicleId}
            position={m.position}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#197c63',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => setSelected({ position: m.position, info: m.info })}
          />
        ))}

        {/* Rota sobre vias: usa polyline salva quando existir; senão tenta API (fallback: linha reta) */}
        {singleRouteForRoad && (
          <RouteOnRoadMap
            key={singleRouteForRoad.route.id}
            origin={singleRouteForRoad.route.origin}
            stops={singleRouteForRoad.route.stops}
            destination={singleRouteForRoad.destination}
            fetchRoute={!singleRouteForRoad.route.polyline?.trim()}
            encodedPolyline={singleRouteForRoad.route.polyline?.trim() || undefined}
            strokeColor="#197c63"
          />
        )}
        {/* Polylines simples (sem API): quando há 0 ou várias rotas */}
        {(!singleRouteForRoad &&
          polylinePaths.map(
            (path, i) =>
              path.length > 1 && (
                <Polyline
                  key={i}
                  path={path}
                  options={{
                    strokeColor: '#197c63',
                    strokeWeight: 4,
                    strokeOpacity: 0.8,
                  }}
                />
              )
          ))}

        {selected && (
          <InfoWindow
            position={selected.position}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-2 min-w-[200px] text-gray-800">
              {selected.info.type === 'stop' && selected.info.stop && (
                <>
                  <p className="font-semibold text-red-600">Parada {selected.info.stop.order}</p>
                  <p className="text-sm">{selected.info.stop.routeName}</p>
                  <p className="text-xs text-gray-600 mt-1">{selected.info.stop.address}</p>
                  <p className="text-xs mt-1">{selected.info.stop.studentsCount} aluno(s)</p>
                </>
              )}
              {selected.info.type === 'vehicle' && selected.info.vehicle && (
                <>
                  <p className="font-semibold text-urban-green">Veículo</p>
                  <p className="text-sm">{selected.info.vehicle.plate} — {selected.info.vehicle.model}</p>
                  <p className="text-xs text-gray-600">Motorista: {selected.info.vehicle.driverName}</p>
                </>
              )}
              {selected.info.type === 'school' && selected.info.school && (
                <>
                  <p className="font-semibold text-blue-600">Escola</p>
                  <p className="text-sm">{selected.info.school.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{selected.info.school.address}</p>
                  <p className="text-xs mt-1">Diretor(a): {selected.info.school.principal}</p>
                </>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

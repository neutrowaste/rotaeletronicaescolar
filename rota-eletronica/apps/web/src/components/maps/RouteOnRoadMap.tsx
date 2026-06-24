/**
 * Componente de referência: rota sobre vias no mapa (Google Routes API + encodedPolyline).
 *
 * - Chama https://routes.googleapis.com/directions/v2:computeRoutes com
 *   origin, destination e intermediates (vehicleStopover: true).
 * - Usa a encodedPolyline da resposta para desenhar a rota no mapa.
 *
 * Uso: envolver dentro de <GoogleMap> (useJsApiLoader já carregado).
 */

import { useState, useEffect, useMemo } from 'react';
import { Polyline } from '@react-google-maps/api';
import { computeRoute, buildComputeRouteParams } from '@/services/routingService';
import { decodePolyline } from '@/utils/polylineUtils';
import type { Coordinates } from '@rota-eletronica/shared-types';

export interface RouteOnRoadMapProps {
  /** Ponto de partida (ex.: garagem) */
  origin: Coordinates;
  /** Paradas intermediárias (embarque/desembarque) */
  stops: Array<{ coordinates: Coordinates }>;
  /** Ponto de chegada (ex.: escola) */
  destination: Coordinates;
  /** Se true, chama a API ao montar; se false, só desenha se encodedPolyline for passado */
  fetchRoute?: boolean;
  /** Polyline já obtida (evita nova chamada à API) */
  encodedPolyline?: string | null;
  /** Cor da linha no mapa (padrão verde UrbanData) */
  strokeColor?: string;
  /** Callback com o resultado da rota (polyline, distância, duração) */
  onRouteComputed?: (result: { encodedPolyline: string; distanceMeters: number; durationSeconds: number }) => void;
}

const DEFAULT_STROKE = '#197c63';

export function RouteOnRoadMap({
  origin,
  stops,
  destination,
  fetchRoute = true,
  encodedPolyline: encodedProp,
  strokeColor = DEFAULT_STROKE,
  onRouteComputed,
}: RouteOnRoadMapProps) {
  const [encoded, setEncoded] = useState<string | null>(encodedProp ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (encodedProp != null) {
      setEncoded(encodedProp);
      setLoading(false);
      setError(null);
      return;
    }
    if (!fetchRoute || (origin.lat === 0 && origin.lng === 0)) return;

    setLoading(true);
    setError(null);
    const params = buildComputeRouteParams(origin, stops, destination);
    computeRoute(params)
      .then((result) => {
        if (result) {
          setEncoded(result.encodedPolyline);
          onRouteComputed?.({
            encodedPolyline: result.encodedPolyline,
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
          });
        } else {
          setError('Rota não calculada');
        }
      })
      .catch((err) => {
        setError(err?.message ?? 'Erro ao calcular rota');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchRoute, origin.lat, origin.lng, destination.lat, destination.lng, encodedProp, onRouteComputed, stops.length]);

  const path = useMemo(() => {
    if (!encoded) return [];
    return decodePolyline(encoded).map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [encoded]);

  const fallbackPath = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [origin, ...stops.map((s) => s.coordinates), destination];
    return pts.filter((p) => p.lat !== 0 || p.lng !== 0);
  }, [origin, stops, destination]);

  if (loading) {
    return fallbackPath.length >= 2 ? (
      <Polyline
        path={fallbackPath}
        options={{
          strokeColor,
          strokeWeight: 4,
          strokeOpacity: 0.5,
          geodesic: false,
        }}
      />
    ) : null;
  }

  if (path.length >= 2) {
    return (
      <Polyline
        path={path}
        options={{
          strokeColor,
          strokeWeight: 5,
          strokeOpacity: 0.9,
          geodesic: true,
        }}
      />
    );
  }

  if (error && fallbackPath.length >= 2) {
    return (
      <Polyline
        path={fallbackPath}
        options={{
          strokeColor,
          strokeWeight: 4,
          strokeOpacity: 0.6,
          geodesic: false,
        }}
      />
    );
  }

  return null;
}

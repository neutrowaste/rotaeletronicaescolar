# Referência: Rota sobre vias com Google Routes API

Modelagem para **ônibus escolar** com pontos de embarque e desembarque, compatível com a estrutura oficial de waypoints do Google:

- **origin**: garagem, escola ou ponto inicial da rota  
- **destination**: escola, garagem ou último ponto  
- **intermediates**: embarques e desembarques  
- **vehicleStopover: true** nos pontos em que o ônibus realmente para  

---

## 1. Chamada à API (serviço)

**Endpoint:** `POST https://routes.googleapis.com/directions/v2:computeRoutes`

**Headers:**
- `Content-Type: application/json`
- `X-Goog-Api-Key: SUA_CHAVE`
- `X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs`

**Body (exemplo):**
```json
{
  "origin": {
    "location": {
      "latLng": { "latitude": -23.55, "longitude": -46.63 }
    }
  },
  "destination": {
    "location": {
      "latLng": { "latitude": -23.56, "longitude": -46.64 }
    }
  },
  "intermediates": [
    {
      "location": {
        "latLng": { "latitude": -23.551, "longitude": -46.631 }
      },
      "vehicleStopover": true
    }
  ],
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE",
  "languageCode": "pt-BR",
  "units": "METRIC"
}
```

**Resposta (exemplo):**
```json
{
  "routes": [{
    "distanceMeters": 5000,
    "duration": "600s",
    "polyline": {
      "encodedPolyline": "ipkcFfichVnP@j@BLoFVwM..."
    }
  }]
}
```

Implementação em: `src/services/routingService.ts`

---

## 2. Decodificar encodedPolyline e desenhar no mapa

A `encodedPolyline` usa o [Google Polyline Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm). Decodificação em: `src/utils/polylineUtils.ts`.

---

## 3. Bloco React com @react-google-maps/api

Uso dentro de `<GoogleMap>` (após `useJsApiLoader`):

```tsx
import { GoogleMap, Polyline } from '@react-google-maps/api';
import { computeRoute, buildComputeRouteParams } from '@/services/routingService';
import { decodePolyline } from '@/utils/polylineUtils';

// Exemplo: origem, paradas e destino da sua rota
const origin = { lat: -23.55, lng: -46.63 };
const stops = [
  { coordinates: { lat: -23.551, lng: -46.631 } },
  { coordinates: { lat: -23.552, lng: -46.632 } },
];
const destination = { lat: -23.56, lng: -46.64 };

// 1) Calcular rota (origin → intermediates (vehicleStopover) → destination)
const params = buildComputeRouteParams(origin, stops, destination);
const result = await computeRoute(params);

if (result) {
  // 2) Decodificar polyline
  const path = decodePolyline(result.encodedPolyline).map((p) => ({ lat: p.lat, lng: p.lng }));

  // 3) Desenhar no mapa
  <GoogleMap ...>
    <Polyline
      path={path}
      options={{
        strokeColor: '#197c63',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        geodesic: true,
      }}
    />
  </GoogleMap>
}
```

Componente pronto que faz isso: `src/components/maps/RouteOnRoadMap.tsx`.

---

## 4. Uso do componente RouteOnRoadMap

```tsx
<GoogleMap ...>
  <RouteOnRoadMap
    origin={route.origin}
    stops={route.stops}
    destination={school.coordinates}
    fetchRoute={true}
    strokeColor="#197c63"
    onRouteComputed={({ encodedPolyline, distanceMeters, durationSeconds }) => {
      console.log('Rota calculada:', distanceMeters, 'm', durationSeconds, 's');
    }}
  />
</GoogleMap>
```

Quando `fetchRoute` é `true`, o componente chama `computeRoute` e desenha a rota sobre vias. Se você já tiver a `encodedPolyline`, passe `encodedPolyline={...}` e `fetchRoute={false}`.

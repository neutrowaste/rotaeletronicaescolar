/**
 * Geocoding via Google Geocoding API (REST).
 * Usado para: centro do município e lat/lng do endereço completo.
 */

const apiKey =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyDQ6bE-mNRKpvMJeZWIz6eyLt5uXH7sJzc';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Converte um endereço em latitude e longitude.
 * Retorna null se não encontrar ou em caso de erro.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const params = new URLSearchParams({
      address: trimmed,
      key: apiKey,
      language: 'pt-BR',
    });
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

/**
 * Retorna o centro (lat/lng) do município a partir de nome e UF.
 * Ex.: "Campinas", "SP" → geocode "Campinas, SP, Brasil"
 */
export async function geocodeMunicipalityCenter(
  municipalityName: string,
  uf: string
): Promise<GeocodeResult | null> {
  const name = municipalityName.trim();
  if (!name || !uf) return null;
  return geocodeAddress(`${name}, ${uf}, Brasil`);
}

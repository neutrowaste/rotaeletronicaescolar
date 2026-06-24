const apiKey =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.VITE_GOOGLE_MAPS_API_KEY ??
  'AIzaSyDQ6bE-mNRKpvMJeZWIz6eyLt5uXH7sJzc';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GeocodeResult {
  lat: number;
  lng: number;
}

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
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    };
    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

/**
 * Configuração única do Google Maps Loader para toda a aplicação.
 * O useJsApiLoader NÃO pode ser chamado com opções diferentes em componentes distintos:
 * todos os mapas devem usar exatamente estas opções para evitar
 * "Loader must not be called again with different options".
 */
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDQ6bE-mNRKpvMJeZWIz6eyLt5uXH7sJzc';

export const GOOGLE_MAPS_LOADER_OPTIONS = {
  googleMapsApiKey: apiKey,
  language: 'pt-BR',
  libraries: ['places'] as const,
} as const;

import type { Garage } from '@rota-eletronica/shared-types';

/** Garagens mockadas — 2 por município para demo */
const BASE_GARAGES: Omit<Garage, 'id'>[] = [
  // MUN001 Campinas
  { name: 'Garagem Centro Campinas', address: 'Av. José de Souza Campos, 500', municipalityId: 'MUN001', coordinates: { lat: -22.9071, lng: -47.0632 } },
  { name: 'Garagem Norte Campinas', address: 'Av. John Boyd Dunlop, 3200', municipalityId: 'MUN001', coordinates: { lat: -22.9312, lng: -47.0521 } },
  // MUN002 Sorocaba
  { name: 'Garagem Sorocaba Norte', address: 'Rua da Garagem, 100', municipalityId: 'MUN002', coordinates: { lat: -23.5020, lng: -47.4580 } },
  { name: 'Garagem Sorocaba Sul', address: 'Av. Itavuvu, 13500', municipalityId: 'MUN002', coordinates: { lat: -23.5480, lng: -47.4120 } },
  // MUN003 Jundiaí
  { name: 'Garagem Jundiaí Centro', address: 'Av. 9 de Julho, 200', municipalityId: 'MUN003', coordinates: { lat: -23.1864, lng: -46.8842 } },
  { name: 'Garagem Jundiaí Vila Arens', address: 'Rua Barão de Jundiaí, 1200', municipalityId: 'MUN003', coordinates: { lat: -23.1980, lng: -46.8720 } },
  // MUN004 Ribeirão Preto
  { name: 'Garagem Ribeirão Preto Centro', address: 'Rod. Anhanguera Km 310', municipalityId: 'MUN004', coordinates: { lat: -21.1775, lng: -47.8103 } },
  { name: 'Garagem Ribeirão Preto Oeste', address: 'Av. Nove de Julho, 2500', municipalityId: 'MUN004', coordinates: { lat: -21.1820, lng: -47.8350 } },
  // MUN005 São José dos Campos
  { name: 'Garagem SJC Centro', address: 'Av. São José, 150', municipalityId: 'MUN005', coordinates: { lat: -23.1896, lng: -45.8841 } },
  { name: 'Garagem SJC Leste', address: 'Av. Andrômeda, 500', municipalityId: 'MUN005', coordinates: { lat: -23.2010, lng: -45.8620 } },
  // MUN006 Bauru
  { name: 'Garagem Bauru Centro', address: 'Av. Nações Unidas, 30', municipalityId: 'MUN006', coordinates: { lat: -22.3145, lng: -49.0604 } },
  { name: 'Garagem Bauru Norte', address: 'Av. Duque de Caxias, 2400', municipalityId: 'MUN006', coordinates: { lat: -22.2980, lng: -49.0720 } },
  // MUN007 Santo André
  { name: 'Garagem Santo André Centro', address: 'Rua das Garagens, 80', municipalityId: 'MUN007', coordinates: { lat: -23.6639, lng: -46.5322 } },
  { name: 'Garagem Santo André Utinga', address: 'Rua dos Transportes, 450', municipalityId: 'MUN007', coordinates: { lat: -23.6520, lng: -46.5180 } },
  // MUN008 Piracicaba
  { name: 'Garagem Piracicaba Centro', address: 'Av. Armando de Salles Oliveira, 100', municipalityId: 'MUN008', coordinates: { lat: -22.7256, lng: -47.6487 } },
  { name: 'Garagem Piracicaba Sul', address: 'Rod. Luiz de Queiroz, Km 2', municipalityId: 'MUN008', coordinates: { lat: -22.7380, lng: -47.6380 } },
  // MUN009 São José do Rio Preto
  { name: 'Garagem Rio Preto Centro', address: 'Av. Alberto Andaló, 300', municipalityId: 'MUN009', coordinates: { lat: -20.8197, lng: -49.3794 } },
  { name: 'Garagem Rio Preto Redentora', address: 'Av. Bady Bassitt, 3500', municipalityId: 'MUN009', coordinates: { lat: -20.8080, lng: -49.3620 } },
  // MUN010 Araçatuba
  { name: 'Garagem Araçatuba Centro', address: 'Rod. Marechal Rondon, Km 500', municipalityId: 'MUN010', coordinates: { lat: -21.2087, lng: -50.4326 } },
  { name: 'Garagem Araçatuba Sul', address: 'Av. da Saudade, 800', municipalityId: 'MUN010', coordinates: { lat: -21.2180, lng: -50.4250 } },
  // MUN011 Marília
  { name: 'Garagem Marília Centro', address: 'Av. Nelson Spielmann, 200', municipalityId: 'MUN011', coordinates: { lat: -22.2174, lng: -49.9502 } },
  { name: 'Garagem Marília Leste', address: 'Av. Sampaio Vidal, 1200', municipalityId: 'MUN011', coordinates: { lat: -22.2120, lng: -49.9380 } },
  // MUN012 Presidente Prudente
  { name: 'Garagem Prudente Centro', address: 'Rua Tenente Nicolau M. dos Santos, 50', municipalityId: 'MUN012', coordinates: { lat: -22.1256, lng: -51.3889 } },
  { name: 'Garagem Prudente Jardim Bongiovani', address: 'Av. Coronel Marcondes, 2500', municipalityId: 'MUN012', coordinates: { lat: -22.1180, lng: -51.4020 } },
];

export const garages: Garage[] = BASE_GARAGES.map((g, i) => ({
  ...g,
  id: `GRG${String(i + 1).padStart(3, '0')}`,
}));

/** Garagem padrão por município (para veículos sem garageId em mocks antigos) */
export function getGarageByMunicipality(municipalityId: string): Garage | undefined {
  return garages.find((g) => g.municipalityId === municipalityId);
}

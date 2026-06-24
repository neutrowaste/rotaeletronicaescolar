import type { Route, Vehicle } from '@rota-eletronica/shared-types';

const VEHICLE_STATUS_IN_OPTION: Record<Vehicle['status'], string> = {
  active: 'ativo',
  maintenance: 'manutenção',
  inactive: 'inativo',
};

export function vehicleSelectLabel(v: Vehicle): string {
  const base = `${v.plate} — ${v.brand} ${v.model}`;
  if (v.status === 'active') return base;
  const status = VEHICLE_STATUS_IN_OPTION[v.status] ?? v.status;
  return `${base} (${status})`;
}

/** Veículos ativos podem ser escolhidos; na edição mantém o já vinculado se inativo/em manutenção. */
export function isVehicleSelectableForSchedule(v: Vehicle, currentVehicleId: string): boolean {
  if (v.status === 'active') return true;
  return v.id === currentVehicleId;
}

export type ScheduleVehiclePool = {
  vehicles: Vehicle[];
  /** Rota legada sem garagem cadastrada — lista por município. */
  legacyNoGarage: boolean;
  garageName?: string;
};

function sortVehiclesForSelect(list: Vehicle[]): Vehicle[] {
  const order: Record<Vehicle['status'], number> = { active: 0, maintenance: 1, inactive: 2 };
  return [...list].sort((a, b) => {
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return a.plate.localeCompare(b.plate, 'pt-BR');
  });
}

/** Todos os veículos da garagem da rota (ou do município em rotas legadas), para exibir no select da escala. */
export function vehiclesForSchedule(
  vehiclesList: Vehicle[],
  route: Route | undefined,
  getGarageName?: (garageId: string) => string | undefined
): ScheduleVehiclePool {
  if (!route) {
    return { vehicles: [], legacyNoGarage: false };
  }

  const inMunicipality = vehiclesList.filter((v) => v.municipalityId === route.municipalityId);

  let pool: Vehicle[];
  let legacyNoGarage = false;
  let garageName: string | undefined;

  if (!route.garageId) {
    pool = inMunicipality;
    legacyNoGarage = true;
  } else {
    garageName = getGarageName?.(route.garageId);
    pool = inMunicipality.filter((v) => v.garageId === route.garageId);
  }

  return { vehicles: sortVehiclesForSelect(pool), legacyNoGarage, garageName };
}

/** Há ao menos um veículo ativo na lista para nova escala. */
export function hasActiveVehicleInPool(vehicles: Vehicle[]): boolean {
  return vehicles.some((v) => v.status === 'active');
}

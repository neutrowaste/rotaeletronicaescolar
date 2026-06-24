import { create } from 'zustand';

export interface MapFiltersFromSchedule {
  municipalityId: string;
  routeId: string;
  schoolId: string;
  shift: string;
}

export interface MapFiltersFromRecord {
  municipalityId?: string;
  routeId?: string;
  schoolId?: string;
  shift?: string;
}

export interface MapFiltersState {
  municipalityId: string;
  routeId: string;
  shift: string;
  schoolId: string;
  setMunicipalityId: (id: string) => void;
  setRouteId: (id: string) => void;
  setShift: (shift: string) => void;
  setSchoolId: (id: string) => void;
  setFiltersFromSchedule: (filters: MapFiltersFromSchedule) => void;
  /** Preenche os filtros do mapa a partir de qualquer registro (rota, escola, município) e redireciona para /mapa */
  setFiltersFromRecord: (filters: MapFiltersFromRecord) => void;
  clearFilters: () => void;
}

const initial = {
  municipalityId: '',
  routeId: '',
  shift: '',
  schoolId: '',
};

export const useMapFiltersStore = create<MapFiltersState>((set) => ({
  ...initial,
  setMunicipalityId: (municipalityId) => set({ municipalityId, routeId: '', schoolId: '' }),
  setRouteId: (routeId) => set({ routeId }),
  setShift: (shift) => set({ shift }),
  setSchoolId: (schoolId) => set({ schoolId }),
  setFiltersFromSchedule: ({ municipalityId, routeId, schoolId, shift }) =>
    set({ municipalityId, routeId, schoolId, shift }),
  setFiltersFromRecord: (filters) =>
    set({
      municipalityId: filters.municipalityId ?? '',
      routeId: filters.routeId ?? '',
      schoolId: filters.schoolId ?? '',
      shift: filters.shift ?? '',
    }),
  clearFilters: () => set(initial),
}));

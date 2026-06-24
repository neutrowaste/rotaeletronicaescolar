import type { Vehicle } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';
import { upsertById } from '@/store/storeHelpers';

interface VehiclesState {
  items: Vehicle[];
  loading: boolean;
  error: string | null;
  fetchVehicles: (municipalityId?: string, opts?: { silent?: boolean }) => Promise<void>;
  fetchVehicleById: (id: string) => Promise<Vehicle | undefined>;
  upsertVehicle: (vehicle: Vehicle) => void;
  getVehicles: () => Vehicle[];
  getVehicleById: (id: string) => Vehicle | undefined;
  addVehicle: (vehicle: Omit<Vehicle, 'id'> | Vehicle) => Promise<Vehicle>;
  updateVehicle: (vehicle: Vehicle) => Promise<void>;
  removeVehicle: (id: string) => Promise<void>;
}

export const useVehiclesStore = create<VehiclesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchVehicles: async (municipalityId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.vehicles.list(municipalityId);
      const list = Array.isArray(res) ? (res as Vehicle[]) : (res as { data: Vehicle[] }).data;
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar veículos', loading: false });
    }
  },

  fetchVehicleById: async (id: string) => {
    const cached = get().items.find((v) => v.id === id);
    if (cached) return cached;
    try {
      const vehicle = (await api.vehicles.get(id)) as Vehicle;
      set((s) => ({ items: upsertById(s.items, vehicle) }));
      return vehicle;
    } catch {
      return undefined;
    }
  },

  upsertVehicle: (vehicle: Vehicle) => {
    set((s) => ({ items: upsertById(s.items, vehicle) }));
  },

  getVehicles: () => get().items,
  getVehicleById: (id: string) => get().items.find((v) => v.id === id),

  addVehicle: async (vehicle: Omit<Vehicle, 'id'> | Vehicle) => {
    const body = 'id' in vehicle && vehicle.id ? vehicle : { ...vehicle, id: '' };
    const created = (await api.vehicles.create(body)) as Vehicle;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateVehicle: async (vehicle: Vehicle) => {
    await api.vehicles.update(vehicle.id, vehicle);
    set((s) => ({
      items: s.items.map((v) => (v.id === vehicle.id ? vehicle : v)),
    }));
  },

  removeVehicle: async (id: string) => {
    await api.vehicles.delete(id);
    set((s) => ({ items: s.items.filter((v) => v.id !== id) }));
  },
}));

import type { Garage } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';

interface GaragesState {
  items: Garage[];
  loading: boolean;
  error: string | null;
  fetchGarages: (municipalityId?: string, opts?: { silent?: boolean }) => Promise<void>;
  setItems: (items: Garage[]) => void;
  getGarages: () => Garage[];
  getGarageById: (id: string) => Garage | undefined;
  addGarage: (garage: Omit<Garage, 'id'> | Garage) => Promise<Garage>;
  updateGarage: (garage: Garage) => Promise<void>;
  removeGarage: (id: string) => Promise<void>;
}

export const useGaragesStore = create<GaragesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchGarages: async (municipalityId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.garages.list(municipalityId);
      const list = Array.isArray(res) ? (res as Garage[]) : (res as { data: Garage[] }).data;
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar garagens', loading: false });
    }
  },

  setItems: (items: Garage[]) => set({ items }),

  getGarages: () => get().items,
  getGarageById: (id: string) => get().items.find((g) => g.id === id),

  addGarage: async (garage: Omit<Garage, 'id'> | Garage) => {
    const body = 'id' in garage && garage.id ? garage : { ...garage, id: '' };
    const created = (await api.garages.create(body)) as Garage;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateGarage: async (garage: Garage) => {
    await api.garages.update(garage.id, garage);
    set((s) => ({
      items: s.items.map((g) => (g.id === garage.id ? garage : g)),
    }));
  },

  removeGarage: async (id: string) => {
    await api.garages.delete(id);
    set((s) => ({ items: s.items.filter((g) => g.id !== id) }));
  },
}));

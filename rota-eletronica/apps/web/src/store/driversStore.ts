import type { Driver } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';
import { upsertById } from '@/store/storeHelpers';

interface DriversState {
  items: Driver[];
  loading: boolean;
  error: string | null;
  fetchDrivers: (municipalityId?: string, opts?: { silent?: boolean }) => Promise<void>;
  fetchDriverById: (id: string) => Promise<Driver | undefined>;
  upsertDriver: (driver: Driver) => void;
  getDrivers: () => Driver[];
  getDriverById: (id: string) => Driver | undefined;
  addDriver: (driver: Omit<Driver, 'id'> | Driver) => Promise<Driver>;
  updateDriver: (driver: Driver) => Promise<void>;
  removeDriver: (id: string) => Promise<void>;
}

export const useDriversStore = create<DriversState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchDrivers: async (municipalityId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.drivers.list(municipalityId, { page: 1, pageSize: 500 });
      const list = Array.isArray(res) ? (res as Driver[]) : (res as { data: Driver[] }).data ?? [];
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar motoristas', loading: false });
    }
  },

  fetchDriverById: async (id: string) => {
    const cached = get().items.find((d) => d.id === id);
    if (cached) return cached;
    try {
      const driver = (await api.drivers.get(id)) as Driver;
      set((s) => ({ items: upsertById(s.items, driver) }));
      return driver;
    } catch {
      return undefined;
    }
  },

  upsertDriver: (driver: Driver) => {
    set((s) => ({ items: upsertById(s.items, driver) }));
  },

  getDrivers: () => get().items,
  getDriverById: (id: string) => get().items.find((d) => d.id === id),

  addDriver: async (driver: Omit<Driver, 'id'> | Driver) => {
    const body = 'id' in driver && driver.id ? driver : { ...driver, id: '' };
    const created = (await api.drivers.create(body)) as Driver;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateDriver: async (driver: Driver) => {
    await api.drivers.update(driver.id, driver);
    set((s) => ({
      items: s.items.map((d) => (d.id === driver.id ? driver : d)),
    }));
  },

  removeDriver: async (id: string) => {
    await api.drivers.delete(id);
    set((s) => ({ items: s.items.filter((d) => d.id !== id) }));
  },
}));

import type { Municipality } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';
import { upsertById } from '@/store/storeHelpers';

interface MunicipalitiesState {
  items: Municipality[];
  loading: boolean;
  error: string | null;
  setItems: (items: Municipality[]) => void;
  fetchMunicipalities: (opts?: { silent?: boolean }) => Promise<void>;
  fetchMunicipalityById: (id: string) => Promise<Municipality | undefined>;
  getMunicipalities: () => Municipality[];
  getMunicipalityById: (id: string) => Municipality | undefined;
  addMunicipality: (municipality: Omit<Municipality, 'id'> | Municipality) => Promise<Municipality>;
  updateMunicipality: (municipality: Municipality) => Promise<void>;
  removeMunicipality: (id: string) => Promise<void>;
}

export const useMunicipalitiesStore = create<MunicipalitiesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  setItems: (items: Municipality[]) => set({ items }),

  fetchMunicipalities: async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.municipalities.list();
      const list = Array.isArray(res) ? (res as Municipality[]) : (res as { data: Municipality[] }).data;
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar municípios', loading: false });
    }
  },

  fetchMunicipalityById: async (id: string) => {
    const cached = get().items.find((m) => m.id === id);
    if (cached) return cached;
    try {
      const municipality = (await api.municipalities.get(id)) as Municipality;
      set((s) => ({ items: upsertById(s.items, municipality) }));
      return municipality;
    } catch {
      return undefined;
    }
  },

  getMunicipalities: () => get().items,
  getMunicipalityById: (id: string) => get().items.find((m) => m.id === id),

  addMunicipality: async (municipality: Omit<Municipality, 'id'> | Municipality) => {
    const body = 'id' in municipality ? municipality : { ...municipality, id: '' };
    const created = (await api.municipalities.create(body)) as Municipality;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateMunicipality: async (municipality: Municipality) => {
    await api.municipalities.update(municipality.id, municipality);
    set((s) => ({
      items: s.items.map((m) => (m.id === municipality.id ? municipality : m)),
    }));
  },

  removeMunicipality: async (id: string) => {
    await api.municipalities.delete(id);
    set((s) => ({ items: s.items.filter((m) => m.id !== id) }));
  },
}));

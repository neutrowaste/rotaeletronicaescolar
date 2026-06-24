import type { Route } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';

interface RoutesState {
  items: Route[];
  loading: boolean;
  error: string | null;
  fetchRoutes: (municipalityId?: string, opts?: { silent?: boolean }) => Promise<void>;
  setItems: (items: Route[]) => void;
  getRoutes: () => Route[];
  getRouteById: (id: string) => Route | undefined;
  isCustomRoute: (id: string) => boolean;
  addRoute: (route: Omit<Route, 'id'> | Route) => Promise<Route>;
  updateRoute: (id: string, route: Partial<Route>) => Promise<void>;
  removeRoute: (id: string) => Promise<void>;
}

export const useRoutesStore = create<RoutesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchRoutes: async (municipalityId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.routes.list(municipalityId);
      const list = Array.isArray(res) ? (res as Route[]) : (res as { data: Route[] }).data;
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar rotas', loading: false });
    }
  },

  setItems: (items: Route[]) => set({ items }),

  getRoutes: () => get().items,
  getRouteById: (id: string) => get().items.find((r) => r.id === id),
  isCustomRoute: () => true,

  addRoute: async (route: Omit<Route, 'id'> | Route) => {
    const body = 'id' in route && route.id ? route : { ...route, id: '' };
    const created = (await api.routes.create(body)) as Route;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateRoute: async (id: string, updates: Partial<Route>) => {
    await api.routes.update(id, updates);
    set((s) => ({
      items: s.items.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  },

  removeRoute: async (id: string) => {
    await api.routes.delete(id);
    set((s) => ({ items: s.items.filter((r) => r.id !== id) }));
  },
}));

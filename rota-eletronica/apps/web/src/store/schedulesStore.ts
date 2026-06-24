import type { Schedule } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';

/** GET /schedules: array ou { data, total?, page? }; qualquer outro → []. */
export function schedulesListFromResponse(res: unknown): Schedule[] {
  if (Array.isArray(res)) return res as Schedule[];
  if (res && typeof res === 'object' && 'data' in res) {
    const d = (res as { data: unknown }).data;
    if (Array.isArray(d)) return d as Schedule[];
  }
  return [];
}

interface SchedulesState {
  items: Schedule[];
  loading: boolean;
  error: string | null;
  fetchSchedules: (routeId?: string, opts?: { silent?: boolean }) => Promise<void>;
  setItems: (items: Schedule[]) => void;
  getSchedules: () => Schedule[];
  getScheduleById: (id: string) => Schedule | undefined;
  addSchedule: (schedule: Omit<Schedule, 'id'> | Schedule) => Promise<Schedule>;
  updateSchedule: (schedule: Schedule) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
}

export const useSchedulesStore = create<SchedulesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchSchedules: async (routeId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.schedules.list(routeId);
      const list = schedulesListFromResponse(res);
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar escalas', loading: false });
    }
  },

  setItems: (items: Schedule[]) => set({ items }),

  getSchedules: () => get().items,
  getScheduleById: (id: string) => get().items.find((s) => s.id === id),

  addSchedule: async (schedule: Omit<Schedule, 'id'> | Schedule) => {
    const body = 'id' in schedule && schedule.id ? schedule : { ...schedule, id: '' };
    const created = (await api.schedules.create(body)) as Schedule;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateSchedule: async (schedule: Schedule) => {
    await api.schedules.update(schedule.id, schedule);
    set((s) => {
      const idx = s.items.findIndex((x) => x.id === schedule.id);
      if (idx === -1) {
        return { items: [...s.items, schedule] };
      }
      const next = [...s.items];
      next[idx] = schedule;
      return { items: next };
    });
  },

  removeSchedule: async (id: string) => {
    await api.schedules.delete(id);
    set((s) => ({ items: s.items.filter((s) => s.id !== id) }));
  },
}));

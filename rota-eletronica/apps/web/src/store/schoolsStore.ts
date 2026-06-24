import type { School } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';

interface SchoolsState {
  items: School[];
  loading: boolean;
  error: string | null;
  fetchSchools: (municipalityId?: string, opts?: { silent?: boolean }) => Promise<void>;
  setItems: (items: School[]) => void;
  getSchools: () => School[];
  getSchoolById: (id: string) => School | undefined;
  addSchool: (school: School) => Promise<void>;
  updateSchool: (school: School) => Promise<void>;
  removeSchool: (id: string) => Promise<void>;
}

export const useSchoolsStore = create<SchoolsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchSchools: async (municipalityId?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.schools.list(municipalityId);
      const list = Array.isArray(res) ? (res as School[]) : (res as { data: School[] }).data;
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar escolas', loading: false });
    }
  },

  setItems: (items: School[]) => set({ items }),

  getSchools: () => get().items,
  getSchoolById: (id: string) => get().items.find((s) => s.id === id),

  addSchool: async (school: School) => {
    const created = (await api.schools.create(school)) as School;
    set((s) => ({ items: [...s.items, created] }));
  },

  updateSchool: async (school: School) => {
    await api.schools.update(school.id, school);
    set((s) => ({
      items: s.items.map((sc) => (sc.id === school.id ? school : sc)),
    }));
  },

  removeSchool: async (id: string) => {
    await api.schools.delete(id);
    set((s) => ({ items: s.items.filter((s) => s.id !== id) }));
  },
}));

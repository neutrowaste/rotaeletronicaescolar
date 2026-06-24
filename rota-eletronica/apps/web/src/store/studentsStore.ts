import type { Student } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { api } from '@/services/api';
import { upsertById } from '@/store/storeHelpers';

interface StudentsState {
  items: Student[];
  loading: boolean;
  error: string | null;
  fetchStudents: (params?: { municipalityId?: string; schoolId?: string }, opts?: { silent?: boolean }) => Promise<void>;
  fetchStudentById: (id: string) => Promise<Student | undefined>;
  upsertStudent: (student: Student) => void;
  getStudents: () => Student[];
  getStudentById: (id: string) => Student | undefined;
  addStudent: (student: Omit<Student, 'id'> | Student) => Promise<Student>;
  updateStudent: (student: Student) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
}

export const useStudentsStore = create<StudentsState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchStudents: async (params?: { municipalityId?: string; schoolId?: string }, opts?: { silent?: boolean }) => {
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const res = await api.students.list({ ...params, page: 1, pageSize: 500 });
      const list = Array.isArray(res) ? (res as Student[]) : (res as { data: Student[] }).data ?? [];
      set({ items: list, loading: false, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao carregar alunos', loading: false });
    }
  },

  fetchStudentById: async (id: string) => {
    try {
      const student = (await api.students.get(id)) as Student;
      set((s) => ({ items: upsertById(s.items, student) }));
      return student;
    } catch {
      return get().items.find((s) => s.id === id);
    }
  },

  upsertStudent: (student: Student) => {
    set((s) => ({ items: upsertById(s.items, student) }));
  },

  getStudents: () => get().items,
  getStudentById: (id: string) => get().items.find((s) => s.id === id),

  addStudent: async (student: Omit<Student, 'id'> | Student) => {
    const body = 'id' in student && student.id ? student : { ...student, id: '' };
    const created = (await api.students.create(body)) as Student;
    set((s) => ({ items: [...s.items, created] }));
    return created;
  },

  updateStudent: async (student: Student) => {
    await api.students.update(student.id, student);
    set((s) => ({
      items: s.items.map((st) => (st.id === student.id ? student : st)),
    }));
  },

  removeStudent: async (id: string) => {
    await api.students.delete(id);
    set((s) => ({ items: s.items.filter((s) => s.id !== id) }));
  },
}));

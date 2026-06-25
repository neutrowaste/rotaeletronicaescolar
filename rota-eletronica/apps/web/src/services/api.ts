/**
 * Cliente HTTP para a API backend (PostgreSQL UrbanData).
 * Base URL em VITE_API_URL (ex.: http://localhost:3001).
 */

import type { MonitoringVehicleRow } from '@rota-eletronica/shared-types';
import { normalizeStudentImportReport } from '@/utils/normalizeStudentImportReport';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const BASE = ((import.meta as unknown as { env: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const API_BASE = `${BASE}/api`;

/** Payload de sessão retornado por login, bootstrap, /auth/me e PATCH /auth/me */
export type AuthSessionUser = {
  id: string;
  name: string;
  email: string;
  login: string;
  role: string;
  cpf?: string;
  municipioId?: string | null;
  municipioIds?: string[];
  municipios?: Array<{ id: string; name: string; state: string }>;
  ufAtuacao?: string | null;
  setorUnidade?: string | null;
  telefone?: string;
  status?: string;
  deveTrocarSenha?: boolean;
  ultimoAcessoEm?: string | null;
  permissoes?: unknown;
  photo?: string | null;
};

function getToken(): string | null {
  return localStorage.getItem('urbandata_token');
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, ...rest } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  if (!skipAuth) {
    const token = getToken();
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
  return data as T;
}

type ApiRequestInit = RequestInit & { skipAuth?: boolean };

export const api = {
  get: <T>(path: string, opts?: ApiRequestInit) => apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body: unknown, opts?: ApiRequestInit) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, opts?: ApiRequestInit) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: ApiRequestInit) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string, opts?: ApiRequestInit) => apiFetch<void>(path, { ...opts, method: 'DELETE' }),

  auth: {
    login: (login: string, password: string) =>
      apiFetch<{ token: string; user: AuthSessionUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
        skipAuth: true,
      }),
    me: () => api.get<{ user: AuthSessionUser }>('/auth/me'),
    patchMe: (body: Record<string, unknown>) => api.patch<{ user: AuthSessionUser }>('/auth/me', body),
    bootstrapEligible: () =>
      api.get<{ eligible: boolean }>('/auth/bootstrap-eligible', { skipAuth: true }),
    bootstrap: (body: Record<string, unknown>) =>
      api.post<{ token: string; user: AuthSessionUser }>('/auth/bootstrap', body, { skipAuth: true }),
  },
  usuarios: {
    list: (params?: {
      q?: string;
      municipioId?: string;
      perfil?: string;
      status?: string;
      setor?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.q) q.set('q', params.q);
      if (params?.municipioId) q.set('municipioId', params.municipioId);
      if (params?.perfil) q.set('perfil', params.perfil);
      if (params?.status) q.set('status', params.status);
      if (params?.setor) q.set('setor', params.setor);
      if (params?.page != null) q.set('page', String(params.page));
      if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
      const query = q.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(query ? `/usuarios?${query}` : '/usuarios');
    },
    get: (id: string) => api.get<Record<string, unknown>>(`/usuarios/${id}`),
    create: (body: unknown) => api.post<Record<string, unknown>>('/usuarios', body),
    update: (id: string, body: unknown) => api.put<Record<string, unknown>>(`/usuarios/${id}`, body),
    patchStatus: (id: string, status: string) =>
      api.patch<Record<string, unknown>>(`/usuarios/${id}/status`, { status }),
    resetSenha: (id: string) =>
      api.post<{ ok: boolean; message?: string; temporaryPassword?: string }>(`/usuarios/${id}/reset-senha`, {}),
    remove: (id: string) => api.delete(`/usuarios/${id}`),
  },
  perfilPermissoes: {
    get: (perfil: 'GESTOR' | 'OPERADOR') =>
      api.get<{ perfil: string; permissoes: unknown }>(`/perfil-permissoes/${perfil}`),
    patch: (perfil: 'GESTOR' | 'OPERADOR', body: { permissoes: unknown }) =>
      api.patch<{ perfil: string; permissoes: unknown }>(`/perfil-permissoes/${perfil}`, body),
  },
  municipalities: {
    list: (opts?: { page?: number; pageSize?: number; state?: string }) => {
      const q = new URLSearchParams();
      if (opts?.page != null) q.set('page', String(opts.page));
      if (opts?.pageSize != null) q.set('pageSize', String(opts.pageSize));
      if (opts?.state) q.set('state', opts.state);
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/municipalities?${query}` : '/municipalities');
    },
    get: (id: string) => api.get<unknown>(`/municipalities/${id}`),
    create: (body: unknown) => api.post<unknown>('/municipalities', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/municipalities/${id}`, body),
    delete: (id: string) => api.delete(`/municipalities/${id}`),
    /** Multipart: campo do arquivo deve chamar `file`. Atualiza `brasaoUrl` no banco e devolve o município. */
    uploadBrasao: async (municipalityId: string, file: File) => {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/municipalities/${municipalityId}/brasao`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        brasaoUrl?: string;
        municipality?: unknown;
      };
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      return data as { brasaoUrl: string; municipality: unknown };
    },
  },
  schools: {
    list: (municipalityId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (municipalityId) q.set('municipalityId', municipalityId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/schools?${query}` : '/schools');
    },
    get: (id: string) => api.get<unknown>(`/schools/${id}`),
    create: (body: unknown) => api.post<unknown>('/schools', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/schools/${id}`, body),
    delete: (id: string) => api.delete(`/schools/${id}`),
  },
  garages: {
    list: (municipalityId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (municipalityId) q.set('municipalityId', municipalityId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/garages?${query}` : '/garages');
    },
    get: (id: string) => api.get<unknown>(`/garages/${id}`),
    create: (body: unknown) => api.post<unknown>('/garages', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/garages/${id}`, body),
    delete: (id: string) => api.delete(`/garages/${id}`),
  },
  vehicles: {
    list: (municipalityId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (municipalityId) q.set('municipalityId', municipalityId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/vehicles?${query}` : '/vehicles');
    },
    get: (id: string) => api.get<unknown>(`/vehicles/${id}`),
    create: (body: unknown) => api.post<unknown>('/vehicles', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/vehicles/${id}`, body),
    delete: (id: string) => api.delete(`/vehicles/${id}`),
  },
  drivers: {
    list: (municipalityId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (municipalityId) q.set('municipalityId', municipalityId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/drivers?${query}` : '/drivers');
    },
    get: (id: string) => api.get<unknown>(`/drivers/${id}`),
    create: (body: unknown) => api.post<unknown>('/drivers', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/drivers/${id}`, body),
    delete: (id: string) => api.delete(`/drivers/${id}`),
  },
  students: {
    list: (params?: { municipalityId?: string; schoolId?: string; routeId?: string; page?: number; pageSize?: number }) => {
      const q = new URLSearchParams();
      if (params?.municipalityId) q.set('municipalityId', params.municipalityId);
      if (params?.schoolId) q.set('schoolId', params.schoolId);
      if (params?.routeId) q.set('routeId', params.routeId);
      if (params?.page != null) q.set('page', String(params.page));
      if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/students?${query}` : '/students');
    },
    get: (id: string) => api.get<unknown>(`/students/${id}`),
    create: (body: unknown) => api.post<unknown>('/students', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/students/${id}`, body),
    delete: (id: string) => api.delete(`/students/${id}`),
    importBatch: async (file: File, options?: { upsert?: boolean }) => {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const q = options?.upsert === false ? '?upsert=false' : '';
      const res = await fetch(`${API_BASE}/students/import${q}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        totalEnviados?: number;
        totalImportados?: number;
        totalCriados?: number;
        totalAtualizados?: number;
        totalImportadosAlertas?: number;
        totalNaoImportados?: number;
        registros?: Array<{
          linha: number;
          nomeAluno?: string;
          matricula?: string;
          status: 'Criado' | 'Atualizado' | 'Erro';
          alertas?: 'Sim' | '-';
          observacao: string;
        }>;
      };
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      return normalizeStudentImportReport(data as any);
    },
    /** ZIP com alunos.xlsx e pasta fotos/ (nome do .zip é livre). */
    exportZip: async () => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/students/export`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }
      return res.blob();
    },
  },
  routes: {
    list: (municipalityId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (municipalityId) q.set('municipalityId', municipalityId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/routes?${query}` : '/routes');
    },
    get: (id: string) => api.get<unknown>(`/routes/${id}`),
    create: (body: unknown) => api.post<unknown>('/routes', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/routes/${id}`, body),
    delete: (id: string) => api.delete(`/routes/${id}`),
  },
  schedules: {
    list: (routeId?: string, pagination?: { page: number; pageSize: number }) => {
      const q = new URLSearchParams();
      if (routeId) q.set('routeId', routeId);
      if (pagination?.page != null) q.set('page', String(pagination.page));
      if (pagination?.pageSize != null) q.set('pageSize', String(pagination.pageSize));
      const query = q.toString();
      return api.get<unknown[] | PaginatedResponse<unknown>>(query ? `/schedules?${query}` : '/schedules');
    },
    get: (id: string) => api.get<unknown>(`/schedules/${id}`),
    create: (body: unknown) => api.post<unknown>('/schedules', body),
    update: (id: string, body: unknown) => api.patch<unknown>(`/schedules/${id}`, body),
    delete: (id: string) => api.delete(`/schedules/${id}`),
  },
  monitoring: {
    vehicles: () => api.get<{ data: MonitoringVehicleRow[]; date: string }>('/monitoring/vehicles'),
  },
};

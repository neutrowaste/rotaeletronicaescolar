import type { WebUser } from '@rota-eletronica/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type AuthSessionUser } from '@/services/api';
import { isAdminRole } from '@/utils/permissoes';

const TOKEN_KEY = 'urbandata_token';
const USER_KEY = 'urbandata_user';

export interface AuthState {
  user: WebUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<boolean>;
  applySession: (token: string, user: WebUser) => void;
  logout: () => void;
  initFromStorage: () => void;
  /** Atualiza nome, foto e permissões a partir do PostgreSQL (GET /auth/me). */
  syncSessionFromApi: () => Promise<void>;
  updateUserPhoto: (photo: string | null) => void;
  updateUser: (partial: Partial<WebUser>) => void;
}

function normalizeWebRole(r: string): WebUser['role'] {
  const u = r.toUpperCase();
  /** `admin` / `ADMIN` = administrador do sistema — nunca confundir com gestor. */
  if (u === 'ADMIN') return 'ADMIN';
  if (u === 'GESTOR' || r === 'gestor') return 'GESTOR';
  if (u === 'OPERADOR' || r === 'operador') return 'OPERADOR';
  return 'OPERADOR';
}

/** Converte resposta da API de login/bootstrap em WebUser (para persistir sessão). */
export function mapApiUserToWebUser(res: AuthSessionUser): WebUser {
  const role = normalizeWebRole(String(res.role ?? ''));
  const fromApi =
    res.municipioIds?.length ? res.municipioIds : res.municipioId ? [res.municipioId] : [];
  return {
    id: res.id,
    name: res.name,
    email: res.email,
    login: res.login,
    role,
    cpf: res.cpf,
    municipios: res.municipios,
    municipioId: res.municipioId ?? fromApi[0] ?? null,
    ufAtuacao: res.ufAtuacao ?? null,
    setorUnidade: (res.setorUnidade ?? null) as WebUser['setorUnidade'],
    telefone: res.telefone,
    status: res.status as WebUser['status'],
    deveTrocarSenha: res.deveTrocarSenha,
    ultimoAcessoEm: res.ultimoAcessoEm ?? null,
    permissoes: (res.permissoes ?? null) as WebUser['permissoes'],
    photo: res.photo ?? undefined,
    /** ADMIN: lista vazia = todos os municípios. GESTOR/OPERADOR: cidades de atuação. */
    municipalityIds: isAdminRole(role) ? [] : fromApi,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (login: string, password: string) => {
        try {
          const res = await api.auth.login(login, password);
          const user = mapApiUserToWebUser(res.user);
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          set({ user, token: res.token, isAuthenticated: true });
          return true;
        } catch {
          return false;
        }
      },

      applySession: (token: string, user: WebUser) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        set({ user: null, token: null, isAuthenticated: false });
      },

      initFromStorage: () => {
        const token = localStorage.getItem(TOKEN_KEY);
        const userStr = localStorage.getItem(USER_KEY);
        if (token && userStr) {
          try {
            const raw = JSON.parse(userStr) as WebUser & { role?: string };
            const role = normalizeWebRole(String(raw.role ?? ''));
            const municipioId = raw.municipioId ?? null;
            const fromStored = raw.municipalityIds?.length
              ? raw.municipalityIds
              : municipioId
                ? [municipioId]
                : [];
            const municipalityIds = isAdminRole(role) ? [] : fromStored;
            const stored: WebUser = {
              ...raw,
              role,
              login: raw.login ?? raw.email,
              cpf: raw.cpf,
              municipios: raw.municipios,
              municipioId: municipioId ?? fromStored[0] ?? null,
              ufAtuacao: raw.ufAtuacao ?? null,
              setorUnidade:
                raw.setorUnidade != null ? (raw.setorUnidade as WebUser['setorUnidade']) : null,
              municipalityIds,
            };
            set({ user: stored, token, isAuthenticated: true });
          } catch {
            set({ user: null, token: null, isAuthenticated: false });
          }
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      syncSessionFromApi: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        try {
          const { user: u } = await api.auth.me();
          const user = mapApiUserToWebUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          set({ user, token, isAuthenticated: true });
        } catch {
          /* rede ou sessão inválida — mantém estado local */
        }
      },

      updateUserPhoto: (photo: string | null) => {
        set((state) => {
          if (!state.user) return state;
          const updatedUser: WebUser = { ...state.user, photo: photo ?? undefined };
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          } catch {
            // ignore storage errors
          }
          return { user: updatedUser };
        });
      },

      updateUser: (partial: Partial<WebUser>) => {
        set((state) => {
          if (!state.user) return state;
          const updatedUser: WebUser = { ...state.user, ...partial };
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          } catch {
            // ignore storage errors
          }
          return { user: updatedUser };
        });
      },
    }),
    { name: 'urbandata-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);

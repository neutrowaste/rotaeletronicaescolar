import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { isAdminRole } from '@/utils/permissoes';

/** `null` = administrador (sem filtro por município). Lista de ids = restringe aos municípios de atuação. */
export function useScopedMunicipalityIds(): string[] | null {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    if (!user) return [];
    if (isAdminRole(user.role)) return null;
    return user.municipalityIds?.length ? user.municipalityIds : [];
  }, [user]);
}

/**
 * Carrega todos os dados da API em paralelo (uma vez ao entrar no app autenticado).
 * Reduz tempo de espera vs. várias páginas disparando fetches sequenciais/redundantes.
 */
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';
import { useSchoolsStore } from '@/store/schoolsStore';
import { useGaragesStore } from '@/store/garagesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useDriversStore } from '@/store/driversStore';
import { useStudentsStore } from '@/store/studentsStore';
import { useRoutesStore } from '@/store/routesStore';
import { useSchedulesStore } from '@/store/schedulesStore';

/** Carrega listas em paralelo. Cada store trata erro localmente (não interrompe as demais). */
export async function bootstrapAllAppData(): Promise<void> {
  const silent = { silent: true } as const;
  await Promise.all([
    useMunicipalitiesStore.getState().fetchMunicipalities(silent),
    useSchoolsStore.getState().fetchSchools(undefined, silent),
    useGaragesStore.getState().fetchGarages(undefined, silent),
    useVehiclesStore.getState().fetchVehicles(undefined, silent),
    useDriversStore.getState().fetchDrivers(undefined, silent),
    useStudentsStore.getState().fetchStudents(undefined, silent),
    useRoutesStore.getState().fetchRoutes(undefined, silent),
    useSchedulesStore.getState().fetchSchedules(undefined, silent),
  ]);
}

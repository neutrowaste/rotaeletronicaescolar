import type { Student, School, Vehicle, Route } from '@rota-eletronica/shared-types';

/**
 * Calcula os totais de alunos, escolas, veículos e rotas de um município
 * a partir dos cadastros dos respectivos módulos (não usa valores salvos no município).
 */
export function getMunicipalityCounts(
  municipalityId: string,
  students: Student[],
  schools: School[],
  vehicles: Vehicle[],
  routes: Route[]
): { totalStudents: number; totalSchools: number; totalVehicles: number; totalRoutes: number } {
  const totalSchools = schools.filter((s) => s.municipalityId === municipalityId).length;
  const schoolIdsByMun = new Set(
    schools.filter((s) => s.municipalityId === municipalityId).map((s) => s.id)
  );
  const totalStudents = students.filter((s) => schoolIdsByMun.has(s.schoolId)).length;
  const totalVehicles = vehicles.filter((v) => v.municipalityId === municipalityId).length;
  const totalRoutes = routes.filter((r) => r.municipalityId === municipalityId).length;
  return { totalStudents, totalSchools, totalVehicles, totalRoutes };
}

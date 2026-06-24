import type { Route, Student } from '@rota-eletronica/shared-types';

/**
 * Mesma regra de GET /routes: alunos com `routeId` igual ao id da rota (vínculo no cadastro).
 */
export function countLinkedStudentsOnRoute(route: Route, students: Student[]): number {
  let n = 0;
  for (const s of students) {
    if (s.routeId === route.id) n += 1;
  }
  return n;
}

/** @deprecated Use countLinkedStudentsOnRoute */
export const countEffectiveStudentsOnRoute = countLinkedStudentsOnRoute;

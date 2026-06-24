import type { Student } from '@rota-eletronica/shared-types';

/**
 * Retorna a quantidade de alunos cadastrados para a escola (módulo de alunos).
 * Total de alunos não é mais informado manualmente; é calculado automaticamente.
 */
export function getStudentCountForSchool(schoolId: string, students: Student[]): number {
  return students.filter((s) => s.schoolId === schoolId).length;
}

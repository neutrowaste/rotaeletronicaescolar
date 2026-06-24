import type { ParentUser } from '@rota-eletronica/shared-types';
import { students } from './students';

/** 15 usuários pais - cada um vinculado a 1 ou 2 filhos (studentsIds) */
function buildParentUsers(): ParentUser[] {
  const result: ParentUser[] = [];
  const used = new Set<string>();
  let idx = 0;

  for (let i = 0; i < 15; i++) {
    const available = students.filter((s) => !used.has(s.id));
    const count = i < 5 ? 2 : 1;
    const chosen = available.slice(0, count);
    chosen.forEach((s) => used.add(s.id));
    const studentsIds = chosen.map((s) => s.id);
    const name = chosen[0]?.responsible.name ?? `Responsável ${i + 1}`;
    const email = i === 0 ? 'pai@email.com' : `pai${i + 1}@email.com`;
    const phone = chosen[0]?.responsible.phone ?? `(19) 98765-${String(4320 + i).padStart(4, '0')}`;

    result.push({
      id: `PAR${String(idx + 1).padStart(3, '0')}`,
      name,
      email,
      phone,
      studentsIds,
    });
    idx++;
  }

  return result;
}

export const parentUsers: ParentUser[] = buildParentUsers();

import type { Driver } from '@rota-eletronica/shared-types';

export function driverSelectLabel(d: Driver): string {
  if (d.status === 'active') return d.name;
  return `${d.name} (inativo)`;
}

/** Motoristas inativos aparecem na lista, mas não podem ser escolhidos (exceto o já vinculado na edição). */
export function isDriverSelectableForSchedule(d: Driver, currentDriverId: string): boolean {
  if (d.status === 'active') return true;
  return d.id === currentDriverId;
}

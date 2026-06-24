import type { Schedule } from '@rota-eletronica/shared-types';

/** Normaliza data vinda da API (YYYY-MM-DD ou ISO) para YYYY-MM-DD */
export function normalizeScheduleDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
}

/** Data local a partir de ano/mês/dia (evita deslocamento UTC de toISOString) */
export function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Segunda-feira (local) da semana que contém a data YYYY-MM-DD. */
export function getMondayOfWeekContaining(isoDate: string): Date {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMonday);
  return mon;
}

/**
 * Uma data por dia da semana selecionado, todos na mesma semana (seg–dom) que contém `referenceIso`.
 */
export function expandDatesForFrequencyWeek(referenceIso: string, weekdays: number[]): string[] {
  if (!referenceIso?.trim() || weekdays.length === 0) return [];
  const monday = getMondayOfWeekContaining(referenceIso);
  const unique = [...new Set(weekdays)].sort((a, b) => {
    const order = (x: number) => (x === 0 ? 7 : x);
    return order(a) - order(b);
  });
  const out: string[] = [];
  for (const w of unique) {
    const offset = w === 0 ? 6 : w - 1;
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + offset);
    out.push(formatLocalYMD(dt));
  }
  return out;
}

/** Datas entre `periodStart` e `periodEnd` (inclusive) cujo dia da semana está em `weekdays`. */
export function expandDatesInPeriod(periodStart: string, periodEnd: string, weekdays: number[]): string[] {
  if (!periodStart?.trim() || !periodEnd?.trim() || weekdays.length === 0) return [];
  const start = new Date(`${periodStart}T12:00:00`);
  const end = new Date(`${periodEnd}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const set = new Set(weekdays);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (set.has(cur.getDay())) {
      out.push(formatLocalYMD(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Verifica se já existe escala para mesma rota, data e turno (opcional: ignorar um id, ex. edição) */
export function hasScheduleConflict(
  schedules: Schedule[],
  routeId: string,
  date: string,
  shift: string,
  excludeScheduleId?: string
): boolean {
  const nd = normalizeScheduleDate(date);
  return schedules.some(
    (s) =>
      s.id !== excludeScheduleId &&
      s.routeId === routeId &&
      normalizeScheduleDate(s.date) === nd &&
      s.shift === shift
  );
}

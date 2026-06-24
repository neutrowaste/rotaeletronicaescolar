import type { Schedule } from '@rota-eletronica/shared-types';
import { routes } from './routes';

/** 20 escalas mockadas - vinculadas às primeiras 20 rotas */
export const schedules: Schedule[] = routes.slice(0, 20).map((route, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (i % 7));
  const dateStr = date.toISOString().slice(0, 10);
  const shift = route.shift;
  const startHour =
    shift === 'morning' ? '06' : shift === 'afternoon' ? '12' : '07';
  const endHour =
    shift === 'morning' ? '08' : shift === 'afternoon' ? '14' : '17';

  return {
    id: `SCHED${String(i + 1).padStart(3, '0')}`,
    name: `Escala ${route.name} - ${dateStr}`,
    routeId: route.id,
    vehicleId: route.vehicleId ?? '',
    driverId: route.driverId ?? '',
    date: dateStr,
    scheduleKind: i % 5 === 0 ? 'frequency' : 'data',
    shift: route.shift,
    status: i < 6 ? 'in_progress' : i < 14 ? 'completed' : i < 19 ? 'scheduled' : 'cancelled',
    startTime: `${startHour}:00`,
    endTime: `${endHour}:30`,
    incidents: [],
  };
});

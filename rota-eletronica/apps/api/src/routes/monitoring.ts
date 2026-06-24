import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { whereMunicipalityScoped } from '../lib/municipalityScope.js';

type StopRow = {
  id: string;
  order: number;
  address: string;
  coordinates: { lat: number; lng: number };
  studentsIds: string[];
  estimatedArrival: string;
};

function brTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function schedulePriority(status: string): number {
  if (status === 'in_progress') return 0;
  if (status === 'scheduled') return 1;
  if (status === 'completed') return 2;
  return 3;
}

function pickTodaySchedule<T extends { status: string }>(list: T[]): T | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => schedulePriority(a.status) - schedulePriority(b.status))[0] ?? null;
}

function parseStops(raw: unknown): StopRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is StopRow => s != null && typeof s === 'object' && typeof (s as StopRow).order === 'number')
    .sort((a, b) => a.order - b.order);
}

function lastNextLabels(stops: StopRow[], lastPassedOrder: number): { last: string; next: string } {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) return { last: '—', next: '—' };
  if (lastPassedOrder <= 0) {
    return { last: 'Partida', next: ordered[0]?.address ?? '—' };
  }
  const lastStop = [...ordered].filter((s) => s.order <= lastPassedOrder).pop();
  const nextStop = ordered.find((s) => s.order > lastPassedOrder);
  return {
    last: lastStop?.address ?? 'Partida',
    next: nextStop?.address ?? '—',
  };
}

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Manutenção',
  inactive: 'Inativo',
};

const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export default async function monitoringRoutes(app: FastifyInstance) {
  app.get('/monitoring/vehicles', async (request: FastifyRequest, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const where = whereMunicipalityScoped(undefined, request.auth) as Record<string, unknown>;

    const vehicles = await prisma.vehicle.findMany({
      where: where as any,
      orderBy: { plate: 'asc' },
    });

    const vids = vehicles.map((v) => v.id);
    const today = brTodayYmd();

    const schedules =
      vids.length === 0
        ? []
        : await prisma.schedule.findMany({
            where: { vehicleId: { in: vids }, date: today },
            include: { route: true, driver: true },
          });

    const byVehicle = new Map<string, typeof schedules>();
    for (const s of schedules) {
      const arr = byVehicle.get(s.vehicleId) ?? [];
      arr.push(s);
      byVehicle.set(s.vehicleId, arr);
    }

    const rows = vehicles.map((v) => {
      const list = byVehicle.get(v.id) ?? [];
      const sch = pickTodaySchedule(list);
      const route = sch?.route;
      const stops = parseStops(route?.stops);
      const lastPassed = Number((sch as { lastPassedStopOrder?: number } | null)?.lastPassedStopOrder) || 0;
      const { last, next } = lastNextLabels(stops, lastPassed);

      const rawLoc = v.lastLocation as { lat?: number; lng?: number } | null;
      const lastLocation =
        rawLoc != null && typeof rawLoc.lat === 'number' && typeof rawLoc.lng === 'number'
          ? { lat: rawLoc.lat, lng: rawLoc.lng }
          : null;

      return {
        vehicleId: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        vehicleStatus: v.status,
        vehicleStatusLabel: VEHICLE_STATUS_LABEL[v.status] ?? v.status,
        lastLocationAt: v.lastLocationAt ? v.lastLocationAt.toISOString() : null,
        lastLocation,
        routeName: route?.name ?? null,
        routeId: route?.id ?? null,
        driverName: sch?.driver?.name ?? null,
        scheduleStatus: sch?.status ?? null,
        scheduleStatusLabel: sch ? (SCHEDULE_STATUS_LABEL[sch.status] ?? sch.status) : null,
        startTime: sch?.startTime ?? null,
        lastStopLabel: sch ? last : '—',
        nextStopLabel: sch ? next : '—',
      };
    });

    return reply.send({ data: rows, date: today });
  });
}

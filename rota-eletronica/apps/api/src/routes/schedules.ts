import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { getAllowedMunicipalityIds } from '../lib/municipalityScope.js';
import { validateScheduleVehicleForRoute } from '../lib/scheduleVehicleValidation.js';

function toDb(body: Record<string, unknown>) {
  const kind = (body.scheduleKind as string) || 'data';
  const lpo = body.lastPassedStopOrder;
  return {
    name: body.name as string,
    routeId: body.routeId as string,
    vehicleId: body.vehicleId as string,
    driverId: body.driverId as string,
    date: body.date as string,
    shift: body.shift as string,
    status: (body.status as string) || 'scheduled',
    startTime: body.startTime as string,
    endTime: body.endTime as string,
    scheduleKind: kind === 'frequency' ? 'frequency' : 'data',
    ...(lpo !== undefined ? { lastPassedStopOrder: Math.max(0, Math.round(Number(lpo)) || 0) } : {}),
  };
}

export default async function schedulesRoutes(app: FastifyInstance) {
  app.get('/schedules', async (request: FastifyRequest<{ Querystring: { routeId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { routeId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const allowed = getAllowedMunicipalityIds(request.auth);
    let where: Record<string, unknown> = routeId ? { routeId } : {};
    if (allowed !== null) {
      if (allowed.length === 0) {
        where = { id: { in: [] } };
      } else {
        const scope = { route: { municipalityId: { in: allowed } } };
        where = Object.keys(where).length === 0 ? scope : { AND: [where, scope] };
      }
    }
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.schedule.findMany({
          where: where as any,
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          include: { incidents: true },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.schedule.count({ where: where as any }),
      ]);
      return reply.send({ data: list.map(mapToApi.toSchedule), total, page, pageSize });
    }
    const list = await prisma.schedule.findMany({
      where: where as any,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: { incidents: true },
    });
    return reply.send(list.map(mapToApi.toSchedule));
  });

  app.get<{ Params: { id: string } }>('/schedules/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.schedule.findUnique({
      where: { id: request.params.id },
      include: { incidents: true },
    });
    if (!row) return reply.status(404).send({ error: 'Escala não encontrada' });
    return reply.send(mapToApi.toSchedule(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/schedules', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const data = toDb(request.body ?? {});
    if (!data.driverId) {
      return reply.status(400).send({ error: 'Motorista é obrigatório.' });
    }
    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) {
      return reply.status(400).send({ error: 'Motorista não encontrado no sistema.' });
    }
    if (driver.status !== 'active') {
      return reply.status(400).send({ error: 'Não é possível vincular motorista inativo à escala.' });
    }
    const vehicleErr = await validateScheduleVehicleForRoute(data.routeId, data.vehicleId);
    if (vehicleErr) return reply.status(400).send({ error: vehicleErr });
    const row = await prisma.schedule.create({ data, include: { incidents: true } });
    return reply.status(201).send(mapToApi.toSchedule(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/schedules/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.schedule.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Escala não encontrada' });
    const data = toDb({ ...row, ...request.body });
    if (data.driverId) {
      const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
      if (!driver) {
        return reply.status(400).send({ error: 'Motorista não encontrado no sistema.' });
      }
      if (driver.status !== 'active') {
        return reply.status(400).send({ error: 'Não é possível vincular motorista inativo à escala.' });
      }
    }
    const vehicleErr = await validateScheduleVehicleForRoute(data.routeId, data.vehicleId);
    if (vehicleErr) return reply.status(400).send({ error: vehicleErr });
    const updated = await prisma.schedule.update({
      where: { id: request.params.id },
      data,
      include: { incidents: true },
    });
    return reply.send(mapToApi.toSchedule(updated));
  });

  app.delete<{ Params: { id: string } }>('/schedules/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.schedule.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

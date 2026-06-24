import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { getAllowedMunicipalityIds, whereMunicipalityScoped } from '../lib/municipalityScope.js';

function toApiVehicle(row: Record<string, unknown>) {
  const base = mapToApi.toVehicle(row as any);
  const routesCount = (row as any)?._count?.routes;
  return {
    ...base,
    routesCount: typeof routesCount === 'number' ? routesCount : base.routesCount,
  };
}

function toDb(body: Record<string, unknown>) {
  return {
    plate: body.plate as string,
    brand: body.brand as string,
    model: body.model as string,
    year: Number(body.year) || 0,
    color: body.color as string,
    capacity: Number(body.capacity) || 0,
    municipalityId: body.municipalityId as string,
    garageId: body.garageId as string,
    transportType: ((body.transportType as string) || 'nao_informado'),
    driverResponsible: (body.driverResponsible as string) || null,
    renavam: body.renavam as string,
    chassis: body.chassis as string,
    lastInspectionDate: body.lastInspectionDate as string,
    status: (body.status as string) || 'active',
    routesCount: Number(body.routesCount) || 0,
  };
}

export default async function vehiclesRoutes(app: FastifyInstance) {
  app.get('/vehicles', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const where = whereMunicipalityScoped(municipalityId, request.auth) as any;
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          orderBy: { plate: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { _count: { select: { routes: true } } },
        }),
        prisma.vehicle.count({ where }),
      ]);
      return reply.send({ data: list.map(toApiVehicle), total, page, pageSize });
    }
    const list = await prisma.vehicle.findMany({
      where,
      orderBy: { plate: 'asc' },
      include: { _count: { select: { routes: true } } },
    });
    return reply.send(list.map(toApiVehicle));
  });

  app.get<{ Params: { id: string } }>('/vehicles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.vehicle.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { routes: true } } },
    });
    if (!row) return reply.status(404).send({ error: 'Veículo não encontrado' });
    return reply.send(toApiVehicle(row as unknown as Record<string, unknown>));
  });

  app.post<{ Body: Record<string, unknown> }>('/vehicles', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const data = toDb(request.body ?? {});
    const row = await prisma.vehicle.create({ data });
    return reply.status(201).send(mapToApi.toVehicle(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/vehicles/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Veículo não encontrado' });
    const data = toDb({ ...row, ...request.body });
    const updated = await prisma.vehicle.update({ where: { id: request.params.id }, data });
    return reply.send(mapToApi.toVehicle(updated));
  });

  /** Atualização de posição pelo app do motorista (monitoramento). */
  app.patch<{ Params: { id: string }; Body: { lat?: number; lng?: number } }>(
    '/vehicles/:id/location',
    async (request: FastifyRequest<{ Params: { id: string }; Body: { lat?: number; lng?: number } }>, reply: FastifyReply) => {
      await optionalAuthenticate(request, reply);
      const { lat, lng } = request.body ?? {};
      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        return reply.status(400).send({ error: 'Informe lat e lng numéricos' });
      }
      const row = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
      if (!row) return reply.status(404).send({ error: 'Veículo não encontrado' });
      const allowed = getAllowedMunicipalityIds(request.auth);
      if (allowed !== null) {
        if (allowed.length === 0 || !allowed.includes(row.municipalityId)) {
          return reply.status(403).send({ error: 'Sem permissão para este veículo' });
        }
      }
      const updated = await prisma.vehicle.update({
        where: { id: request.params.id },
        data: {
          lastLocation: { lat, lng },
          lastLocationAt: new Date(),
        },
      });
      return reply.send(mapToApi.toVehicle(updated));
    }
  );

  app.delete<{ Params: { id: string } }>('/vehicles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.vehicle.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

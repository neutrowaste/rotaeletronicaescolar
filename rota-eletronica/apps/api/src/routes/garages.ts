import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { whereMunicipalityScoped } from '../lib/municipalityScope.js';

function toDb(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    address: body.address as string,
    municipalityId: body.municipalityId as string,
    coordinates: body.coordinates as object,
  };
}

export default async function garagesRoutes(app: FastifyInstance) {
  app.get('/garages', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const where = whereMunicipalityScoped(municipalityId, request.auth) as any;
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.garage.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.garage.count({ where }),
      ]);
      return reply.send({ data: list.map(mapToApi.toGarage), total, page, pageSize });
    }
    const list = await prisma.garage.findMany({ where, orderBy: { name: 'asc' } });
    return reply.send(list.map(mapToApi.toGarage));
  });

  app.get<{ Params: { id: string } }>('/garages/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.garage.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Garagem não encontrada' });
    return reply.send(mapToApi.toGarage(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/garages', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const data = toDb(request.body ?? {});
    const row = await prisma.garage.create({ data });
    return reply.status(201).send(mapToApi.toGarage(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/garages/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.garage.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Garagem não encontrada' });
    const data = toDb({ ...row, ...request.body });
    const updated = await prisma.garage.update({ where: { id: request.params.id }, data });
    return reply.send(mapToApi.toGarage(updated));
  });

  app.delete<{ Params: { id: string } }>('/garages/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.garage.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

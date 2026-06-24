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
    phone: body.phone as string,
    principal: body.principal as string,
    totalStudents: Number(body.totalStudents) || 0,
    status: (body.status as string) || 'active',
  };
}

export default async function schoolsRoutes(app: FastifyInstance) {
  app.get('/schools', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const where = whereMunicipalityScoped(municipalityId, request.auth) as any;
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.school.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.school.count({ where }),
      ]);
      return reply.send({ data: list.map(mapToApi.toSchool), total, page, pageSize });
    }
    const list = await prisma.school.findMany({ where, orderBy: { name: 'asc' } });
    return reply.send(list.map(mapToApi.toSchool));
  });

  app.get<{ Params: { id: string } }>('/schools/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.school.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Escola não encontrada' });
    return reply.send(mapToApi.toSchool(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/schools', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const data = toDb(request.body ?? {});
    const row = await prisma.school.create({ data });
    return reply.status(201).send(mapToApi.toSchool(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/schools/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.school.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Escola não encontrada' });
    const data = toDb({ ...row, ...request.body });
    const updated = await prisma.school.update({ where: { id: request.params.id }, data });
    return reply.send(mapToApi.toSchool(updated));
  });

  app.delete<{ Params: { id: string } }>('/schools/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.school.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

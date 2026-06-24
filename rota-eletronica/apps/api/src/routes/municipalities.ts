import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { whereMunicipalityEntityList } from '../lib/municipalityScope.js';

function toDb(body: Record<string, unknown>) {
  const { id: _id, ...rest } = body;
  return {
    name: rest.name as string,
    state: rest.state as string,
    ibgeCode: rest.ibgeCode as string,
    coordinates: rest.coordinates ?? undefined,
    responsible: rest.responsible as string,
    responsibleRole: (rest.responsibleRole as string | undefined) ?? undefined,
    phone: rest.phone as string,
    email: rest.email as string,
    contractStart: rest.contractStart as string,
    contractEnd: rest.contractEnd as string,
    contractHistory: rest.contractHistory ?? undefined,
    totalStudents: Number(rest.totalStudents) || 0,
    totalVehicles: Number(rest.totalVehicles) || 0,
    totalRoutes: Number(rest.totalRoutes) || 0,
    status: (rest.status as string) || 'active',
    brasaoUrl:
      rest.brasaoUrl != null && String(rest.brasaoUrl).trim() !== ''
        ? String(rest.brasaoUrl).trim()
        : null,
  };
}

export default async function municipalitiesRoutes(app: FastifyInstance) {
  app.get(
    '/municipalities',
    async (
      request: FastifyRequest<{ Querystring: { page?: string; pageSize?: string; state?: string } }>,
      reply: FastifyReply
    ) => {
      await optionalAuthenticate(request, reply);
      const { page: pageStr, pageSize: pageSizeStr, state: stateFilter } = request.query ?? {};
      const state = stateFilter?.trim();
      const where = whereMunicipalityEntityList(state, request.auth);
      const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
      const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
      if (page != null && pageSize != null) {
        const [list, total] = await Promise.all([
          prisma.municipality.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.municipality.count({ where }),
        ]);
        return reply.send({ data: list.map(mapToApi.toMunicipality), total, page, pageSize });
      }
      const list = await prisma.municipality.findMany({ where, orderBy: { name: 'asc' } });
      return reply.send(list.map(mapToApi.toMunicipality));
    }
  );

  app.get<{ Params: { id: string } }>('/municipalities/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.municipality.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Município não encontrado' });
    return reply.send(mapToApi.toMunicipality(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/municipalities', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const data = toDb(request.body ?? {});
      const row = await prisma.municipality.create({ data: data as any });
      return reply.status(201).send(mapToApi.toMunicipality(row));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao cadastrar município';
      request.log.error(e);
      return reply.status(500).send({ error: msg });
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/municipalities/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.municipality.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Município não encontrado' });
    const data = toDb({ ...row, ...request.body });
    const updated = await prisma.municipality.update({ where: { id: request.params.id }, data: data as any });
    return reply.send(mapToApi.toMunicipality(updated));
  });

  app.delete<{ Params: { id: string } }>('/municipalities/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.municipality.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

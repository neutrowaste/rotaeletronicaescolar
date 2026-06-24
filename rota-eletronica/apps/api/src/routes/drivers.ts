import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { getAllowedMunicipalityIds } from '../lib/municipalityScope.js';
import { driverOverlapsMunicipalities, parseDriverMunicipalityIds } from '../lib/municipalityIds.js';

function toDb(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    cpf: body.cpf as string,
    employeeId: body.employeeId as string,
    address: body.address as string,
    phone: body.phone as string,
    email: body.email as string,
    licenseNumber: body.licenseNumber as string,
    licenseCategory: body.licenseCategory as string,
    licenseExpiry: body.licenseExpiry as string,
    municipalityIds: Array.isArray(body.municipalityIds) ? body.municipalityIds : [],
    status: (body.status as string) || 'active',
  };
}

export default async function driversRoutes(app: FastifyInstance) {
  app.get('/drivers', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const list = await prisma.driver.findMany({ orderBy: { name: 'asc' } });
    const allowed = getAllowedMunicipalityIds(request.auth);
    let scoped = list;
    if (allowed !== null) {
      if (allowed.length === 0) {
        scoped = [];
      } else {
        const allow = new Set(allowed);
        scoped = list.filter((d) => {
          const ids = (d.municipalityIds as string[]) ?? [];
          return ids.some((id) => allow.has(id));
        });
      }
    }
    const filtered = municipalityId
      ? scoped.filter((d) => {
          const ids = (d.municipalityIds as string[]) ?? [];
          return ids.includes(municipalityId);
        })
      : scoped;
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);
      return reply.send({
        data: paginated.map((row) => mapToApi.toDriver(row)),
        total,
        page,
        pageSize,
      });
    }
    return reply.send(filtered.map((row) => mapToApi.toDriver(row)));
  });

  app.get<{ Params: { id: string } }>('/drivers/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.driver.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Motorista não encontrado' });
    return reply.send(mapToApi.toDriver(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/drivers', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const data = toDb(request.body ?? {});
    const row = await prisma.driver.create({ data });
    return reply.status(201).send(mapToApi.toDriver(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/drivers/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.driver.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Motorista não encontrado' });
    const data = toDb({ ...row, municipalityIds: (row.municipalityIds as string[]) ?? [], ...request.body });
    const updated = await prisma.driver.update({ where: { id: request.params.id }, data });
    return reply.send(mapToApi.toDriver(updated));
  });

  app.delete<{ Params: { id: string } }>('/drivers/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.driver.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

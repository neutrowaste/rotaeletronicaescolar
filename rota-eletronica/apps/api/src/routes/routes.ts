import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { whereMunicipalityScoped } from '../lib/municipalityScope.js';

function toApiRoute(row: Record<string, unknown>, linkedStudentCount = 0) {
  const base = mapToApi.toRoute(row as any);
  return {
    ...base,
    totalStudents: linkedStudentCount,
  };
}

function toDb(body: Record<string, unknown>) {
  const driverIdRaw = (body.driverId as string) ?? '';
  const driverId = typeof driverIdRaw === 'string' && driverIdRaw.trim() ? driverIdRaw.trim() : null;
  const vehicleIdRaw = body.vehicleId;
  const vehicleId =
    vehicleIdRaw == null || vehicleIdRaw === ''
      ? null
      : String(vehicleIdRaw).trim() || null;
  const originRaw = body.origin;
  const origin = originRaw != null && typeof originRaw === 'object' && !Array.isArray(originRaw)
    ? originRaw
    : {};
  const stopsRaw = body.stops;
  const stops = Array.isArray(stopsRaw) ? stopsRaw : (stopsRaw != null && typeof stopsRaw === 'object' ? [stopsRaw] : []);

  return {
    name: String((body.name as string) ?? '').trim(),
    municipalityId: String((body.municipalityId as string) ?? '').trim(),
    vehicleId,
    driverId,
    schoolId: String((body.schoolId as string) ?? '').trim(),
    garageId: (body.garageId as string)?.trim() || null,
    shift: (body.shift as string) ?? 'morning',
    totalStudents: Math.round(Number(body.totalStudents) || 0),
    totalStops: Math.round(Number(body.totalStops) || 0),
    estimatedKm: Number(body.estimatedKm) || 0,
    estimatedDuration: Math.round(Number(body.estimatedDuration) || 0),
    status: (body.status as string) || 'active',
    scheduleId: (body.scheduleId as string)?.trim() || null,
    stops,
    polyline: typeof body.polyline === 'string' ? body.polyline : '',
    origin,
    generatedAt: body.generatedAt ? new Date(body.generatedAt as string) : null,
    createdBy: (body.createdBy as string)?.trim() || null,
  };
}

export default async function routesRoutes(app: FastifyInstance) {
  /** Apenas alunos com vínculo explícito no cadastro (`Student.routeId`). */
  const countLinkedStudents = async (routeId: string) =>
    prisma.student.count({ where: { routeId } });

  app.get('/routes', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const where = whereMunicipalityScoped(municipalityId, request.auth) as any;
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.route.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.route.count({ where }),
      ]);
      const totals = await Promise.all(
        list.map((r) =>
          countLinkedStudents(r.id)
        )
      );
      return reply.send({
        data: list.map((r, i) => toApiRoute(r as unknown as Record<string, unknown>, totals[i] ?? 0)),
        total,
        page,
        pageSize,
      });
    }
    const list = await prisma.route.findMany({ where, orderBy: { name: 'asc' } });
    const totals = await Promise.all(
      list.map((r) =>
        countLinkedStudents(r.id)
      )
    );
    return reply.send(
      list.map((r, i) => toApiRoute(r as unknown as Record<string, unknown>, totals[i] ?? 0))
    );
  });

  app.get<{ Params: { id: string } }>('/routes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.route.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Rota não encontrada' });
    const linkedCount = await countLinkedStudents(row.id);
    return reply.send(toApiRoute(row as unknown as Record<string, unknown>, linkedCount));
  });

  app.post<{ Body: Record<string, unknown> }>('/routes', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const data = toDb(request.body ?? {});

      if (!data.name) {
        return reply.status(400).send({ error: 'Nome da rota é obrigatório.' });
      }
      if (!data.municipalityId || !data.garageId || !data.schoolId) {
        return reply.status(400).send({
          error: 'Município, garagem de origem e escola são obrigatórios. Verifique se os dados foram carregados da API.',
        });
      }

      const [municipality, garage, school] = await Promise.all([
        prisma.municipality.findUnique({ where: { id: data.municipalityId } }),
        prisma.garage.findUnique({ where: { id: data.garageId } }),
        prisma.school.findUnique({ where: { id: data.schoolId } }),
      ]);
      if (!municipality) {
        return reply.status(400).send({ error: 'Município não encontrado no sistema. Atualize a lista de municípios pela API.' });
      }
      if (!garage) {
        return reply.status(400).send({ error: 'Garagem não encontrada no sistema.' });
      }
      if (garage.municipalityId !== data.municipalityId) {
        return reply.status(400).send({ error: 'A garagem deve pertencer ao município selecionado.' });
      }
      if (!school) {
        return reply.status(400).send({ error: 'Escola não encontrada no sistema. Atualize a lista de escolas pela API.' });
      }
      if (data.vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
        if (!vehicle) {
          return reply.status(400).send({ error: 'Veículo não encontrado no sistema.' });
        }
      }

      let createdBy = data.createdBy;
      if (createdBy) {
        const creator = await prisma.usuario.findUnique({ where: { id: createdBy } });
        if (!creator) {
          // Usuário do token pode ter sido removido; não bloquear cadastro da rota por isso.
          createdBy = null;
        }
      }

      const row = await prisma.route.create({ data: { ...data, createdBy } });
      const linkedCount = await countLinkedStudents(row.id);
      return reply.status(201).send(toApiRoute(row as unknown as Record<string, unknown>, linkedCount));
    } catch (err: unknown) {
      request.log.error({ err, body: request.body }, 'POST /routes failed');
      const prismaErr = err as { code?: string; meta?: { field_name?: string } };
      if (prismaErr?.code === 'P2003') {
        return reply.status(400).send({
          error: 'Referência inválida: município, veículo, escola, garagem, escala ou usuário responsável não existem no banco. Atualize os dados da API e tente novamente.',
        });
      }
      const message = err instanceof Error ? err.message : 'Erro ao criar rota';
      return reply.status(500).send({ error: message });
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/routes/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.route.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Rota não encontrada' });
    try {
      const body = request.body ?? {};
      const newGarageId =
        body.garageId != null ? String(body.garageId).trim() || null : row.garageId;
      if (newGarageId && row.garageId && newGarageId !== row.garageId) {
        const linkedSchedules = await prisma.schedule.count({
          where: { routeId: row.id, status: { not: 'cancelled' } },
        });
        if (linkedSchedules > 0) {
          return reply.status(400).send({
            error:
              'Não é possível alterar a garagem de origem: existem escalas vinculadas a esta rota. Cancele ou conclua as escalas antes de alterar.',
          });
        }
      }

      const data = toDb({ ...row, ...body });
      if (!data.garageId) {
        return reply.status(400).send({ error: 'Garagem de origem é obrigatória.' });
      }
      const garage = await prisma.garage.findUnique({ where: { id: data.garageId } });
      if (!garage) {
        return reply.status(400).send({ error: 'Garagem não encontrada no sistema.' });
      }
      if (garage.municipalityId !== data.municipalityId) {
        return reply.status(400).send({ error: 'A garagem deve pertencer ao município da rota.' });
      }

      const updated = await prisma.route.update({ where: { id: request.params.id }, data });
      const linkedCount = await countLinkedStudents(updated.id);
      return reply.send(toApiRoute(updated as unknown as Record<string, unknown>, linkedCount));
    } catch (err: unknown) {
      request.log.error({ err, params: request.params, body: request.body }, 'PATCH /routes/:id failed');
      const message = err instanceof Error ? err.message : 'Erro ao atualizar rota';
      return reply.status(500).send({ error: message });
    }
  });

  app.delete<{ Params: { id: string } }>('/routes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.route.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

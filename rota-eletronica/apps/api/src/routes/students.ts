import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { getAllowedMunicipalityIds } from '../lib/municipalityScope.js';
import { buildStudentsExportZip } from '../lib/studentExport.js';
import { buildStudentExportZipFilename } from '../lib/studentCsv.js';
import { runStudentImport } from '../lib/studentImport.js';
import { authenticate } from '../middleware/auth.js';

function toDb(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    registrationNumber: body.registrationNumber as string,
    birthDate: body.birthDate as string,
    grade: body.grade as string,
    shift: body.shift as string,
    schoolId: body.schoolId as string,
    municipalityId: body.municipalityId as string,
    address: body.address as string,
    boardingPoint: body.boardingPoint as object,
    alightingPoint: body.alightingPoint as object,
    responsible: body.responsible as object,
    specialNeeds: Boolean(body.specialNeeds),
    specialNeedsDesc: (body.specialNeedsDescription as string) ?? null,
    routeId: (body.routeId as string) || null,
    status: (body.status as string) || 'active',
    photo: (body.photo as string) || '',
  };
}

export default async function studentsRoutes(app: FastifyInstance) {
  app.get('/students', async (request: FastifyRequest<{ Querystring: { municipalityId?: string; schoolId?: string; routeId?: string; page?: string; pageSize?: string } }>, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const { municipalityId, schoolId, routeId, page: pageStr, pageSize: pageSizeStr } = request.query ?? {};
    const where: Record<string, unknown> = {};
    if (municipalityId) where.municipalityId = municipalityId;
    if (schoolId) where.schoolId = schoolId;
    if (routeId) {
      const route = await prisma.route.findUnique({ where: { id: routeId } });
      if (route) {
        // Retrocompatibilidade: alunos antigos sem routeId, mas com mesma escola/município/turno da rota.
        where.OR = [
          { routeId },
          {
            routeId: null,
            municipalityId: route.municipalityId,
            schoolId: route.schoolId,
            shift: route.shift,
          },
        ];
      } else {
        where.routeId = routeId;
      }
    }
    const allowed = getAllowedMunicipalityIds(request.auth);
    let whereFinal: any = where;
    if (allowed !== null) {
      if (allowed.length === 0) {
        whereFinal = { id: { in: [] } };
      } else {
        const scope = { municipalityId: { in: allowed } };
        whereFinal = Object.keys(where).length === 0 ? scope : { AND: [where, scope] };
      }
    }
    const page = pageStr != null ? Math.max(1, parseInt(pageStr, 10) || 1) : null;
    const pageSize = pageSizeStr != null ? Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20)) : null;
    if (page != null && pageSize != null) {
      const [list, total] = await Promise.all([
        prisma.student.findMany({
          where: whereFinal,
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.student.count({ where: whereFinal }),
      ]);
      return reply.send({ data: list.map(mapToApi.toStudent), total, page, pageSize });
    }
    const list = await prisma.student.findMany({ where: whereFinal, orderBy: { name: 'asc' } });
    return reply.send(list.map(mapToApi.toStudent));
  });

  app.post<{ Querystring: { upsert?: string } }>(
    '/students/import',
    async (
      request: FastifyRequest<{ Querystring: { upsert?: string } }>,
      reply: FastifyReply
    ) => {
      await authenticate(request, reply);
      if (reply.sent) return;

      const upload = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } });
      if (!upload) {
        return reply.status(400).send({ error: 'Envie o arquivo no campo "file" (.zip).' });
      }

      const buffer = await upload.toBuffer();
      const upsert = request.query?.upsert !== 'false';
      const allowed = getAllowedMunicipalityIds(request.auth);

      try {
        const result = await runStudentImport(buffer, upload.filename, {
          allowedMunicipalityIds: allowed,
          upsert,
        });
        return reply.send(result);
      } catch (e) {
        request.log.error(e);
        return reply.status(400).send({
          error: e instanceof Error ? e.message : 'Erro ao importar alunos.',
        });
      }
    }
  );

  app.get('/students/export', async (request: FastifyRequest, reply: FastifyReply) => {
    await optionalAuthenticate(request, reply);
    const allowed = getAllowedMunicipalityIds(request.auth);
    let whereFinal: Record<string, unknown> = {};
    if (allowed !== null) {
      if (allowed.length === 0) {
        whereFinal = { id: { in: [] } };
      } else {
        whereFinal = { municipalityId: { in: allowed } };
      }
    }
    const list = await prisma.student.findMany({
      where: whereFinal,
      orderBy: { name: 'asc' },
      include: {
        school: { select: { name: true } },
        municipality: { select: { name: true, state: true, ibgeCode: true } },
        route: { select: { name: true } },
      },
    });
    const zipBuffer = await buildStudentsExportZip(list);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${buildStudentExportZipFilename()}"`)
      .send(zipBuffer);
  });

  app.get<{ Params: { id: string } }>('/students/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const row = await prisma.student.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Aluno não encontrado' });
    return reply.send(mapToApi.toStudent(row));
  });

  app.post<{ Body: Record<string, unknown> }>('/students', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const body = request.body ?? {};
    const reg = String(body.registrationNumber ?? '').trim();
    if (!reg) return reply.status(400).send({ error: 'Matrícula é obrigatória' });
    const data = toDb(body);
    const row = await prisma.student.create({ data });
    return reply.status(201).send(mapToApi.toStudent(row));
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/students/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const row = await prisma.student.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.status(404).send({ error: 'Aluno não encontrado' });
    const merged = { ...row, ...request.body } as Record<string, unknown>;
    const reg = String(merged.registrationNumber ?? '').trim();
    if (!reg) return reply.status(400).send({ error: 'Matrícula é obrigatória' });
    const data = toDb(merged);
    const updated = await prisma.student.update({ where: { id: request.params.id }, data });
    return reply.send(mapToApi.toStudent(updated));
  });

  app.delete<{ Params: { id: string } }>('/students/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.student.delete({ where: { id: request.params.id } }).catch(() => null);
    return reply.status(204).send();
  });
}

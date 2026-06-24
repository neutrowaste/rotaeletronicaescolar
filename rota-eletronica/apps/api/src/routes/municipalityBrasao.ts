import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { authenticate } from '../middleware/auth.js';
import type { JwtPayload } from '../middleware/auth.js';
import { getAllowedMunicipalityIds } from '../lib/municipalityScope.js';
import {
  removePreviousUploads,
  resolveBrasaoExtension,
  saveBrasaoStream,
} from '../lib/brasaoStorage.js';

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

function canEditMunicipalityBrasao(auth: JwtPayload | undefined, municipalityId: string): boolean {
  if (!auth) return false;
  const allowed = getAllowedMunicipalityIds(auth);
  if (allowed === null) return true;
  return allowed.includes(municipalityId);
}

export default async function municipalityBrasaoRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    '/municipalities/:id/brasao',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await authenticate(request, reply);
      if (reply.sent) return;

      const municipalityId = request.params.id;
      if (!canEditMunicipalityBrasao(request.auth, municipalityId)) {
        return reply.status(403).send({ error: 'Sem permissão para alterar este município' });
      }

      const row = await prisma.municipality.findUnique({ where: { id: municipalityId } });
      if (!row) return reply.status(404).send({ error: 'Município não encontrado' });

      const data = await request.file({ limits: { fileSize: MAX_BYTES } });
      if (!data) {
        return reply.status(400).send({ error: 'Envie um arquivo no campo "file"' });
      }

      const ext = resolveBrasaoExtension(data.mimetype, data.filename);
      if (!ext) {
        return reply.status(400).send({
          error: 'Formato não permitido. Use SVG, JPG, PNG ou WebP.',
        });
      }

      try {
        const filename = await saveBrasaoStream({
          municipalityId,
          ext,
          fileStream: data.file,
        });
        const publicPath = `/uploads/brasoes/${filename}`;
        const updated = await prisma.municipality.update({
          where: { id: municipalityId },
          data: { brasaoUrl: publicPath },
        });
        await removePreviousUploads(municipalityId, filename);
        return reply.send({
          brasaoUrl: publicPath,
          municipality: mapToApi.toMunicipality(updated),
        });
      } catch (e) {
        request.log.error(e);
        return reply.status(500).send({ error: 'Erro ao salvar o arquivo' });
      }
    }
  );
}

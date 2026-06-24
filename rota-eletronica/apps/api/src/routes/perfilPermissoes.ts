import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { parsePermissoesInput, perfilUsaPermissoesGranulares, permissoesFromDb } from '../lib/permissoesUsuario.js';
import { UsuarioPerfil, Prisma } from '../../node_modules/.prisma/api-client/index.js';

export default async function perfilPermissoesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{ Params: { perfil: string } }>(
    '/perfil-permissoes/:perfil',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const p = String(request.params.perfil ?? '').toUpperCase();
      if (p !== 'GESTOR' && p !== 'OPERADOR') {
        return reply.status(400).send({ error: 'Perfil deve ser GESTOR ou OPERADOR.' });
      }
      const perfil = p as UsuarioPerfil;
      const row = await prisma.perfilPermissao.findUnique({ where: { perfil } });
      const perm = row?.permissoes ?? null;
      return reply.send({
        perfil,
        permissoes: permissoesFromDb(perm),
      });
    }
  );

  app.patch<{ Params: { perfil: string }; Body: { permissoes?: unknown } }>(
    '/perfil-permissoes/:perfil',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const p = String(request.params.perfil ?? '').toUpperCase();
      if (p !== 'GESTOR' && p !== 'OPERADOR') {
        return reply.status(400).send({ error: 'Perfil deve ser GESTOR ou OPERADOR.' });
      }
      const perfil = p as UsuarioPerfil;
      if (!perfilUsaPermissoesGranulares(perfil)) {
        return reply.status(400).send({ error: 'Matriz não se aplica a este perfil.' });
      }
      const body = request.body ?? {};
      if (!('permissoes' in body)) {
        return reply.status(400).send({ error: 'Informe o campo permissoes (objeto ou null para acesso total).' });
      }
      let parsed: Prisma.InputJsonValue | typeof Prisma.DbNull;
      try {
        parsed = parsePermissoesInput(body.permissoes);
      } catch (e) {
        return reply.status(400).send({ error: e instanceof Error ? e.message : 'permissoes inválidas' });
      }
      const updated = await prisma.perfilPermissao.upsert({
        where: { perfil },
        create: { perfil, permissoes: parsed },
        update: { permissoes: parsed },
      });
      return reply.send({
        perfil: updated.perfil,
        permissoes: permissoesFromDb(updated.permissoes),
      });
    }
  );
}

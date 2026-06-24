import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  type Prisma,
  UsuarioAuditoriaAcao,
} from '../../node_modules/.prisma/api-client/index.js';
import { prisma } from '../lib/prisma.js';
import { createToken, authenticate } from '../middleware/auth.js';
import { mapToApi } from '../lib/mapToApi.js';
import { encryptAtRest } from '../lib/atRestCrypto.js';
import { hashPassword } from '../lib/passwordHash.js';

const usuarioInclude = {
  usuarioMunicipios: { include: { municipality: { select: { id: true, name: true, state: true } } } },
} as const;

const MAX_FOTO_PERFIL_CHARS = 3_500_000;

function persistFotoPerfil(raw: string | null): string | null {
  if (raw == null || raw === '') return null;
  return encryptAtRest(raw);
}

export default async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const row = await prisma.usuario.findUnique({
      where: { id: request.auth!.userId },
      include: usuarioInclude,
    });
    if (!row) return reply.status(401).send({ error: 'Sessão inválida' });

    let permissoesDb: unknown = null;
    if (row.perfil === 'GESTOR' || row.perfil === 'OPERADOR') {
      const pr = await prisma.perfilPermissao.findUnique({ where: { perfil: row.perfil } });
      permissoesDb = pr?.permissoes ?? null;
    }
    const mids = row.usuarioMunicipios.map((um) => um.municipioId);

    return reply.send({
      user: mapToApi.toUsuarioSessionPlain({
        id: row.id,
        nomeCompleto: row.nomeCompleto,
        cpf: row.cpf,
        email: row.email,
        login: row.login,
        perfil: row.perfil,
        municipioIds: mids,
        municipios: row.usuarioMunicipios.map((um) => ({
          id: um.municipality?.id ?? um.municipioId,
          name: um.municipality?.name ?? '',
          state: um.municipality?.state ?? '',
        })),
        ufAtuacao: row.ufAtuacao ?? null,
        setorUnidade: row.setorUnidade ?? null,
        telefone: row.telefone,
        status: row.status,
        deveTrocarSenha: row.deveTrocarSenha,
        ultimoAcessoEm: row.ultimoAcessoEm,
        fotoPerfil: row.fotoPerfil,
        permissoes: permissoesDb,
      }),
    });
  });

  app.patch<{
    Body: Record<string, unknown>;
  }>('/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const b = request.body ?? {};
    const id = request.auth!.userId;
    const row = await prisma.usuario.findUnique({ where: { id }, include: usuarioInclude });
    if (!row) return reply.status(404).send({ error: 'Usuário não encontrado' });

    const data: Prisma.UsuarioUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(b, 'fotoPerfil')) {
      const fp = b.fotoPerfil;
      if (fp === null) {
        data.fotoPerfil = null;
      } else if (typeof fp === 'string') {
        if (fp.length > MAX_FOTO_PERFIL_CHARS) {
          return reply.status(400).send({ error: 'Foto muito grande. Use uma imagem menor.' });
        }
        data.fotoPerfil = persistFotoPerfil(fp);
      } else {
        return reply.status(400).send({ error: 'fotoPerfil inválido' });
      }
    }

    const senhaAtual = String(b.senhaAtual ?? '');
    const novaSenha = String(b.novaSenha ?? '');
    const confirmar = String(b.confirmarNovaSenha ?? '');
    if (novaSenha || confirmar || senhaAtual) {
      if (!senhaAtual || !novaSenha || !confirmar) {
        return reply
          .status(400)
          .send({ error: 'Para alterar a senha, informe senha atual, nova senha e confirmação.' });
      }
      if (novaSenha !== confirmar) {
        return reply.status(400).send({ error: 'Confirmação da nova senha não confere.' });
      }
      if (novaSenha.length < 8) {
        return reply.status(400).send({ error: 'A nova senha deve ter ao menos 8 caracteres.' });
      }
      const ok = await bcrypt.compare(senhaAtual, row.passwordHash);
      if (!ok) return reply.status(400).send({ error: 'Senha atual incorreta.' });
      data.passwordHash = await hashPassword(novaSenha);
      data.deveTrocarSenha = false;
    }

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'Nenhuma alteração enviada.' });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      include: usuarioInclude,
    });

    await prisma.usuarioAuditoria.create({
      data: {
        usuarioAlvoId: id,
        acao: UsuarioAuditoriaAcao.UPDATE,
        atorId: id,
        detalhes: { selfService: true, campos: Object.keys(data) },
      },
    });

    let permissoesDb: unknown = null;
    if (updated.perfil === 'GESTOR' || updated.perfil === 'OPERADOR') {
      const pr = await prisma.perfilPermissao.findUnique({ where: { perfil: updated.perfil } });
      permissoesDb = pr?.permissoes ?? null;
    }
    const mids = updated.usuarioMunicipios.map((um) => um.municipioId);

    return reply.send({
      user: mapToApi.toUsuarioSessionPlain({
        id: updated.id,
        nomeCompleto: updated.nomeCompleto,
        cpf: updated.cpf,
        email: updated.email,
        login: updated.login,
        perfil: updated.perfil,
        municipioIds: mids,
        municipios: updated.usuarioMunicipios.map((um) => ({
          id: um.municipality?.id ?? um.municipioId,
          name: um.municipality?.name ?? '',
          state: um.municipality?.state ?? '',
        })),
        ufAtuacao: updated.ufAtuacao ?? null,
        setorUnidade: updated.setorUnidade ?? null,
        telefone: updated.telefone,
        status: updated.status,
        deveTrocarSenha: updated.deveTrocarSenha,
        ultimoAcessoEm: updated.ultimoAcessoEm,
        fotoPerfil: updated.fotoPerfil,
        permissoes: permissoesDb,
      }),
    });
  });

  app.post<{
    Body: { login?: string; password?: string; email?: string };
  }>('/auth/login', async (request: FastifyRequest<{ Body: { login?: string; password?: string; email?: string } }>, reply: FastifyReply) => {
    const body = request.body ?? {};
    const password = body.password;
    const loginInput = (body.login ?? body.email ?? '').trim();
    if (!loginInput || !password) {
      return reply.status(400).send({ error: 'Login e senha são obrigatórios' });
    }

    const normalized = loginInput.toLowerCase();

    const user = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: { equals: normalized, mode: 'insensitive' } },
          { login: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: usuarioInclude,
    });

    if (!user) {
      return reply.status(401).send({ error: 'Login ou senha inválidos' });
    }

    if (user.status === 'BLOQUEADO') {
      return reply.status(403).send({ error: 'Usuário bloqueado. Contate o gestor.' });
    }
    if (user.status === 'INATIVO') {
      return reply.status(403).send({ error: 'Usuário inativo.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Login ou senha inválidos' });
    }

    const updated = await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoAcessoEm: new Date() },
      include: usuarioInclude,
    });

    await prisma.usuarioAuditoria.create({
      data: {
        usuarioAlvoId: user.id,
        acao: UsuarioAuditoriaAcao.LOGIN,
        atorId: null,
        detalhes: { ip: request.ip },
      },
    });

    let permissoesPerfil: unknown = null;
    if (user.perfil === 'GESTOR' || user.perfil === 'OPERADOR') {
      const row = await prisma.perfilPermissao.findUnique({ where: { perfil: user.perfil } });
      permissoesPerfil = row?.permissoes ?? null;
    }

    const mids = updated.usuarioMunicipios.map((um) => um.municipioId);

    const token = createToken({
      userId: updated.id,
      email: updated.email,
      role: updated.perfil,
      municipioIds: mids,
      ...(mids[0] ? { municipioId: mids[0] } : {}),
      ...(updated.ufAtuacao ? { ufAtuacao: updated.ufAtuacao } : {}),
      ...(updated.setorUnidade ? { setor: updated.setorUnidade } : {}),
    });

    return reply.send({
      token,
      user: mapToApi.toUsuarioSessionPlain({
        id: updated.id,
        nomeCompleto: updated.nomeCompleto,
        cpf: updated.cpf,
        email: updated.email,
        login: updated.login,
        perfil: updated.perfil,
        municipioIds: mids,
        municipios: updated.usuarioMunicipios.map((um) => ({
          id: um.municipality?.id ?? um.municipioId,
          name: um.municipality?.name ?? '',
          state: um.municipality?.state ?? '',
        })),
        ufAtuacao: updated.ufAtuacao ?? null,
        setorUnidade: updated.setorUnidade ?? null,
        telefone: updated.telefone,
        status: updated.status,
        deveTrocarSenha: updated.deveTrocarSenha,
        ultimoAcessoEm: updated.ultimoAcessoEm,
        fotoPerfil: updated.fotoPerfil,
        permissoes: permissoesPerfil,
      }),
    });
  });
}

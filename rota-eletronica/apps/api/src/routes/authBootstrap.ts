/**
 * Primeiro administrador (perfil ADMIN) quando a tabela usuarios está vazia.
 * Desative em produção: DISABLE_BOOTSTRAP=true
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/passwordHash.js';
import { createToken } from '../middleware/auth.js';
import { mapToApi } from '../lib/mapToApi.js';
import { normalizeCpfDigits } from '../lib/cpf.js';
import {
  UsuarioAuditoriaAcao,
  UsuarioPerfil,
  UsuarioStatus,
} from '../../node_modules/.prisma/api-client/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bootstrapDisabled(): boolean {
  return process.env.DISABLE_BOOTSTRAP === 'true' || process.env.DISABLE_BOOTSTRAP === '1';
}

export default async function authBootstrapRoutes(app: FastifyInstance) {
  app.get('/auth/bootstrap-eligible', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (bootstrapDisabled()) {
      return reply.send({ eligible: false });
    }
    const count = await prisma.usuario.count();
    return reply.send({ eligible: count === 0 });
  });

  app.post<{
    Body: Record<string, unknown>;
  }>('/auth/bootstrap', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    if (bootstrapDisabled()) {
      return reply.status(403).send({ error: 'Cadastro inicial desativado neste ambiente.' });
    }
    if ((await prisma.usuario.count()) > 0) {
      return reply.status(403).send({ error: 'Já existe usuário cadastrado. Use o login ou peça a um gestor.' });
    }

    const b = request.body ?? {};
    const nomeCompleto = String(b.nomeCompleto ?? '').trim();
    const cpfRaw = String(b.cpf ?? '');
    const email = String(b.email ?? '').trim().toLowerCase();
    const telefone = String(b.telefone ?? '').trim();
    const login = String(b.login ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const confirmarSenha = String(b.confirmarSenha ?? '');
    const municipioId = String(b.municipioId ?? '').trim();
    const setorUnidade = String(b.setorUnidade ?? '').trim();

    if (!nomeCompleto) return reply.status(400).send({ error: 'Nome completo é obrigatório' });
    const cpf = normalizeCpfDigits(cpfRaw);
    if (!cpf) return reply.status(400).send({ error: 'CPF é obrigatório' });
    if (!email || !EMAIL_RE.test(email)) return reply.status(400).send({ error: 'E-mail inválido' });
    if (!telefone) return reply.status(400).send({ error: 'Telefone é obrigatório' });
    if (!login || login.length < 3) return reply.status(400).send({ error: 'Login deve ter ao menos 3 caracteres' });
    if (!password) return reply.status(400).send({ error: 'Senha é obrigatória' });
    if (password !== confirmarSenha) return reply.status(400).send({ error: 'Confirmação de senha não confere' });
    if (!['SETOR_TRANSPORTE', 'SETOR_MAPAS', 'SETOR_EDUCACAO'].includes(setorUnidade)) {
      return reply.status(400).send({ error: 'Setor (unidade) inválido' });
    }

    let ufAtuacao: string | null = null;
    const municipioIdsBoot: string[] = [];
    if (municipioId) {
      const mun = await prisma.municipality.findUnique({ where: { id: municipioId } });
      if (!mun) return reply.status(400).send({ error: 'Município não encontrado' });
      ufAtuacao = mun.state.trim().toUpperCase().slice(0, 2);
      municipioIdsBoot.push(municipioId);
    }

    const passwordHash = await hashPassword(password);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.usuario.create({
          data: {
            nomeCompleto,
            cpf,
            email,
            telefone,
            login,
            passwordHash,
            perfil: UsuarioPerfil.ADMIN,
            status: UsuarioStatus.ATIVO,
            ufAtuacao,
            setorUnidade: setorUnidade as 'SETOR_TRANSPORTE' | 'SETOR_MAPAS' | 'SETOR_EDUCACAO',
            deveTrocarSenha: false,
          },
        });
        if (municipioIdsBoot.length > 0) {
          await tx.usuarioMunicipio.createMany({
            data: municipioIdsBoot.map((mid) => ({ usuarioId: u.id, municipioId: mid })),
          });
        }
        return u;
      });

      await prisma.usuarioAuditoria.create({
        data: {
          usuarioAlvoId: created.id,
          acao: UsuarioAuditoriaAcao.CREATE,
          atorId: null,
          detalhes: { bootstrap: true },
        },
      });

      const refreshed = await prisma.usuario.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          usuarioMunicipios: { include: { municipality: { select: { id: true, name: true, state: true } } } },
        },
      });
      const mids = refreshed.usuarioMunicipios.map((x) => x.municipioId);

      const token = createToken({
        userId: refreshed.id,
        email: refreshed.email,
        role: UsuarioPerfil.ADMIN,
        municipioIds: mids,
        ...(mids[0] ? { municipioId: mids[0] } : {}),
        ...(refreshed.ufAtuacao ? { ufAtuacao: refreshed.ufAtuacao } : {}),
        ...(refreshed.setorUnidade ? { setor: refreshed.setorUnidade } : {}),
      });

      return reply.status(201).send({
        token,
        user: mapToApi.toUsuarioSession(refreshed, null),
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2002') {
        return reply.status(409).send({ error: 'CPF, e-mail ou login já cadastrado' });
      }
      throw err;
    }
  });
}

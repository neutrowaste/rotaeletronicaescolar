import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { hashPassword } from '../lib/passwordHash.js';
import { prisma } from '../lib/prisma.js';
import { mapToApi } from '../lib/mapToApi.js';
import { authenticate, requireGestor, requireGestorOrSelf } from '../middleware/auth.js';
import { normalizeCpfDigits } from '../lib/cpf.js';
import { validarUfEMunicipios } from '../lib/usuarioVinculo.js';
import {
  UsuarioAuditoriaAcao,
  UsuarioPerfil,
  UsuarioStatus,
  UsuarioSetor,
  Prisma,
} from '../../node_modules/.prisma/api-client/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const usuarioPublicInclude = {
  usuarioMunicipios: { include: { municipality: { select: { id: true, name: true, state: true } } } },
} as const;

/** Mensagem quando o banco ainda tem NOT NULL em município/setor (migration não aplicada). */
const ERR_DB_NULLABLE_VINCULO =
  'Não foi possível salvar sem município/setor: o banco precisa estar atualizado. Na pasta apps/api execute: npm run db:migrate';

function isNullConstraintViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2011') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /null value in column|NotNullViolation|not-null constraint/i.test(msg);
}

function parseMunicipioIds(b: Record<string, unknown>): string[] {
  const raw = b.municipioIds;
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function audit(
  usuarioAlvoId: string,
  acao: (typeof UsuarioAuditoriaAcao)[keyof typeof UsuarioAuditoriaAcao],
  atorId: string | null,
  detalhes?: Prisma.InputJsonValue
) {
  return prisma.usuarioAuditoria.create({
    data: { usuarioAlvoId, acao, atorId, detalhes },
  });
}

/** JWT legado `admin` = antigo gestor — mesmo escopo de município. */
function isGestorAuthRole(role: string | undefined): boolean {
  const r = String(role ?? '');
  return r === 'GESTOR' || r === 'gestor' || r === 'admin';
}

function isAdminAuthRole(role: string | undefined): boolean {
  return String(role ?? '').trim().toUpperCase() === 'ADMIN';
}

function gestorMunicipioIds(request: FastifyRequest): string[] {
  return request.auth?.municipioIds?.length
    ? request.auth!.municipioIds!
    : request.auth?.municipioId
      ? [request.auth.municipioId]
      : [];
}

/** Gestor só altera usuários que ele mesmo criou (e não ADMIN). */
function gestorPodeGerenciarUsuario(
  atorId: string,
  alvo: { perfil: UsuarioPerfil; criadoPorUsuarioId: string | null }
): boolean {
  if (alvo.perfil === UsuarioPerfil.ADMIN) return false;
  return alvo.criadoPorUsuarioId === atorId;
}

export default async function usuariosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get<{
    Querystring: {
      q?: string;
      municipioId?: string;
      perfil?: string;
      status?: string;
      setor?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/usuarios', { preHandler: [requireGestor] }, async (request, reply) => {
    const q = request.query.q?.trim();
    const municipioId = request.query.municipioId?.trim();
    const perfil = request.query.perfil as UsuarioPerfil | undefined;
    const status = request.query.status as UsuarioStatus | undefined;
    const setor = request.query.setor as UsuarioSetor | undefined;
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(request.query.pageSize ?? '20', 10) || 20));

    const auth = request.auth!;
    const parts: Prisma.UsuarioWhereInput[] = [];

    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      const mids = gestorMunicipioIds(request);
      if (mids.length === 0) {
        return reply.send({ data: [], total: 0, page, pageSize });
      }
      parts.push({
        AND: [
          { perfil: { not: UsuarioPerfil.ADMIN } },
          { usuarioMunicipios: { some: { municipioId: { in: mids } } } },
        ],
      });
    }

    if (municipioId) {
      if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
        const mids = gestorMunicipioIds(request);
        if (!mids.includes(municipioId)) {
          return reply.send({ data: [], total: 0, page, pageSize });
        }
      }
      parts.push({ usuarioMunicipios: { some: { municipioId } } });
    }
    if (perfil && Object.values(UsuarioPerfil).includes(perfil)) parts.push({ perfil });
    if (status && (status === 'ATIVO' || status === 'INATIVO' || status === 'BLOQUEADO')) parts.push({ status });
    if (setor && ['SETOR_TRANSPORTE', 'SETOR_MAPAS', 'SETOR_EDUCACAO'].includes(setor)) {
      parts.push({ setorUnidade: setor as (typeof UsuarioSetor)[keyof typeof UsuarioSetor] });
    }
    if (q) {
      const qDigits = normalizeCpfDigits(q);
      parts.push({
        OR: [
          { nomeCompleto: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { login: { contains: q, mode: 'insensitive' } },
          { cpf: { contains: qDigits || q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.UsuarioWhereInput = parts.length ? { AND: parts } : {};

    const [total, rows] = await prisma.$transaction([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        include: usuarioPublicInclude,
        orderBy: { nomeCompleto: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return reply.send({
      data: rows.map((r) => mapToApi.toUsuarioPublic(r)),
      total,
      page,
      pageSize,
    });
  });

  app.get<{ Params: { id: string } }>('/usuarios/:id', { preHandler: [requireGestorOrSelf] }, async (request, reply) => {
    const auth = request.auth!;
    const row = await prisma.usuario.findUnique({
      where: { id: request.params.id },
      include: usuarioPublicInclude,
    });
    if (!row) return reply.status(404).send({ error: 'Usuário não encontrado' });

    if (auth.userId !== row.id && isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (row.perfil === UsuarioPerfil.ADMIN) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }
      const mids = gestorMunicipioIds(request);
      const overlap = row.usuarioMunicipios.some((um) => mids.includes(um.municipioId));
      if (!overlap) return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    return reply.send(mapToApi.toUsuarioPublic(row));
  });

  app.post<{
    Body: Record<string, unknown>;
  }>('/usuarios', { preHandler: [requireGestor] }, async (request, reply) => {
    const b = request.body ?? {};
    const nomeCompleto = String(b.nomeCompleto ?? '').trim();
    const cpfRaw = String(b.cpf ?? '');
    const email = String(b.email ?? '').trim().toLowerCase();
    const telefone = String(b.telefone ?? '').trim();
    const login = String(b.login ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const confirmarSenha = String(b.confirmarSenha ?? '');
    const perfil = b.perfil as string;
    const setorUnidade = String(b.setorUnidade ?? '').trim();
    const ufAtuacao = String(b.ufAtuacao ?? '').trim().toUpperCase();
    const municipioIds = parseMunicipioIds(b);

    if (!nomeCompleto) return reply.status(400).send({ error: 'Nome completo é obrigatório' });
    const cpf = normalizeCpfDigits(cpfRaw);
    if (!cpf) return reply.status(400).send({ error: 'CPF é obrigatório' });
    if (!email || !EMAIL_RE.test(email)) return reply.status(400).send({ error: 'E-mail inválido' });
    if (!telefone) return reply.status(400).send({ error: 'Telefone é obrigatório' });
    if (!login || login.length < 3) return reply.status(400).send({ error: 'Login deve ter ao menos 3 caracteres' });
    if (!password) return reply.status(400).send({ error: 'Senha é obrigatória na criação' });
    if (password !== confirmarSenha) return reply.status(400).send({ error: 'Confirmação de senha não confere' });
    if (!perfil || !Object.values(UsuarioPerfil).includes(perfil as UsuarioPerfil)) {
      return reply.status(400).send({ error: 'Perfil inválido' });
    }
    const perfilEnum = perfil as UsuarioPerfil;
    const isAdmin = perfilEnum === UsuarioPerfil.ADMIN;

    if (!isAdmin) {
      if (!setorUnidade || !Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)) {
        return reply.status(400).send({ error: 'Setor (unidade) é obrigatório' });
      }
      const v = await validarUfEMunicipios(ufAtuacao, municipioIds);
      if (!v.ok) return reply.status(400).send({ error: v.error });
    } else {
      if (setorUnidade && !Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)) {
        return reply.status(400).send({ error: 'Setor (unidade) inválido' });
      }
      if (municipioIds.length > 0) {
        const v = await validarUfEMunicipios(ufAtuacao, municipioIds);
        if (!v.ok) return reply.status(400).send({ error: v.error });
      }
    }

    const finalSetor: UsuarioSetor | null = isAdmin
      ? setorUnidade && Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)
        ? (setorUnidade as UsuarioSetor)
        : null
      : (setorUnidade as UsuarioSetor);

    const finalUf = isAdmin ? (municipioIds.length ? ufAtuacao : null) : ufAtuacao;

    const passwordHash = await hashPassword(password);
    const atorId = request.auth!.userId;
    const auth = request.auth!;

    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (perfilEnum === UsuarioPerfil.ADMIN) {
        return reply.status(403).send({ error: 'Gestores não podem criar administradores.' });
      }
      const mids = gestorMunicipioIds(request);
      for (const mid of municipioIds) {
        if (!mids.includes(mid)) {
          return reply.status(403).send({ error: 'Município fora da sua área de atuação.' });
        }
      }
    }

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
            perfil: perfilEnum,
            status: UsuarioStatus.ATIVO,
            ufAtuacao: finalUf,
            setorUnidade: finalSetor,
            deveTrocarSenha: false,
            criadoPorUsuarioId: atorId,
          },
        });
        if (municipioIds.length > 0) {
          await tx.usuarioMunicipio.createMany({
            data: municipioIds.map((mid) => ({ usuarioId: u.id, municipioId: mid })),
          });
        }
        return u;
      });

      const full = await prisma.usuario.findUniqueOrThrow({
        where: { id: created.id },
        include: usuarioPublicInclude,
      });
      await audit(created.id, UsuarioAuditoriaAcao.CREATE, atorId, { login: created.login });
      return reply.status(201).send(mapToApi.toUsuarioPublic(full));
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2002') {
        return reply.status(409).send({ error: 'CPF, e-mail ou login já cadastrado' });
      }
      if (isNullConstraintViolation(err)) {
        return reply.status(400).send({ error: ERR_DB_NULLABLE_VINCULO });
      }
      throw err;
    }
  });

  app.put<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>('/usuarios/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const id = request.params.id;
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado' });

    const auth = request.auth!;
    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (!gestorPodeGerenciarUsuario(auth.userId, existing)) {
        return reply.status(403).send({ error: 'Sem permissão para alterar este cadastro.' });
      }
    }

    const b = request.body ?? {};
    const nomeCompleto = String(b.nomeCompleto ?? '').trim();
    const cpfRaw = String(b.cpf ?? '');
    const email = String(b.email ?? '').trim().toLowerCase();
    const telefone = String(b.telefone ?? '').trim();
    const login = String(b.login ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const confirmarSenha = String(b.confirmarSenha ?? '');
    const perfil = b.perfil as string;
    const setorUnidade = String(b.setorUnidade ?? '').trim();
    const status = b.status as string;
    const ufAtuacao = String(b.ufAtuacao ?? '').trim().toUpperCase();
    const municipioIds = parseMunicipioIds(b);

    if (!nomeCompleto) return reply.status(400).send({ error: 'Nome completo é obrigatório' });
    const cpf = normalizeCpfDigits(cpfRaw);
    if (!cpf) return reply.status(400).send({ error: 'CPF é obrigatório' });
    if (!email || !EMAIL_RE.test(email)) return reply.status(400).send({ error: 'E-mail inválido' });
    if (!telefone) return reply.status(400).send({ error: 'Telefone é obrigatório' });
    if (!login || login.length < 3) return reply.status(400).send({ error: 'Login deve ter ao menos 3 caracteres' });
    if (!perfil || !Object.values(UsuarioPerfil).includes(perfil as UsuarioPerfil)) {
      return reply.status(400).send({ error: 'Perfil inválido' });
    }
    const perfilEnum = perfil as UsuarioPerfil;
    const isAdmin = perfilEnum === UsuarioPerfil.ADMIN;

    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (perfilEnum === UsuarioPerfil.ADMIN) {
        return reply.status(403).send({ error: 'Gestores não podem definir perfil administrador.' });
      }
      const mids = gestorMunicipioIds(request);
      for (const mid of municipioIds) {
        if (!mids.includes(mid)) {
          return reply.status(403).send({ error: 'Município fora da sua área de atuação.' });
        }
      }
    }

    if (!isAdmin) {
      if (!setorUnidade || !Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)) {
        return reply.status(400).send({ error: 'Setor (unidade) é obrigatório' });
      }
      const v = await validarUfEMunicipios(ufAtuacao, municipioIds);
      if (!v.ok) return reply.status(400).send({ error: v.error });
    } else {
      if (setorUnidade && !Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)) {
        return reply.status(400).send({ error: 'Setor (unidade) inválido' });
      }
      if (municipioIds.length > 0) {
        const v = await validarUfEMunicipios(ufAtuacao, municipioIds);
        if (!v.ok) return reply.status(400).send({ error: v.error });
      }
    }
    if (!status || !Object.values(UsuarioStatus).includes(status as UsuarioStatus)) {
      return reply.status(400).send({ error: 'Status inválido' });
    }

    if (password && password !== confirmarSenha) {
      return reply.status(400).send({ error: 'Confirmação de senha não confere' });
    }

    const finalSetor: UsuarioSetor | null = isAdmin
      ? setorUnidade && Object.values(UsuarioSetor).includes(setorUnidade as UsuarioSetor)
        ? (setorUnidade as UsuarioSetor)
        : null
      : (setorUnidade as UsuarioSetor);

    const finalUf = isAdmin ? (municipioIds.length ? ufAtuacao : null) : ufAtuacao;

    const data: Prisma.UsuarioUncheckedUpdateInput = {
      nomeCompleto,
      cpf,
      email,
      telefone,
      login,
      perfil: perfilEnum,
      ufAtuacao: finalUf,
      setorUnidade: finalSetor,
      status: status as UsuarioStatus,
    };

    if (password) {
      data.passwordHash = await hashPassword(password);
    }

    const atorId = request.auth!.userId;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.usuario.update({
          where: { id },
          data,
        });
        await tx.usuarioMunicipio.deleteMany({ where: { usuarioId: id } });
        if (municipioIds.length > 0) {
          await tx.usuarioMunicipio.createMany({
            data: municipioIds.map((mid) => ({ usuarioId: id, municipioId: mid })),
          });
        }
        return u;
      });

      const full = await prisma.usuario.findUniqueOrThrow({
        where: { id: updated.id },
        include: usuarioPublicInclude,
      });
      await audit(id, UsuarioAuditoriaAcao.UPDATE, atorId, { login: updated.login });
      return reply.send(mapToApi.toUsuarioPublic(full));
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === 'P2002') {
        return reply.status(409).send({ error: 'CPF, e-mail ou login já cadastrado' });
      }
      if (isNullConstraintViolation(err)) {
        return reply.status(400).send({ error: ERR_DB_NULLABLE_VINCULO });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { status?: string };
  }>('/usuarios/:id/status', { preHandler: [requireGestor] }, async (request, reply) => {
    const id = request.params.id;
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado' });

    const auth = request.auth!;
    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (!gestorPodeGerenciarUsuario(auth.userId, existing)) {
        return reply.status(403).send({ error: 'Sem permissão para alterar este cadastro.' });
      }
    }

    const status = request.body?.status as string;
    if (!status || !Object.values(UsuarioStatus).includes(status as UsuarioStatus)) {
      return reply.status(400).send({ error: 'Status inválido' });
    }

    const atorId = request.auth!.userId;
    const updated = await prisma.usuario.update({
      where: { id },
      data: { status: status as UsuarioStatus },
      include: usuarioPublicInclude,
    });
    await audit(id, UsuarioAuditoriaAcao.STATUS_CHANGE, atorId, { status });
    return reply.send(mapToApi.toUsuarioPublic(updated));
  });

  app.post<{ Params: { id: string } }>('/usuarios/:id/reset-senha', { preHandler: [requireGestor] }, async (request, reply) => {
    const id = request.params.id;
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado' });

    const auth = request.auth!;
    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (!gestorPodeGerenciarUsuario(auth.userId, existing)) {
        return reply.status(403).send({ error: 'Sem permissão para alterar este cadastro.' });
      }
    }

    const tempPass = randomBytes(12).toString('base64url');
    const passwordHash = await hashPassword(tempPass);
    const atorId = request.auth!.userId;

    await prisma.usuario.update({
      where: { id },
      data: { passwordHash, deveTrocarSenha: true },
    });
    await audit(id, UsuarioAuditoriaAcao.RESET_SENHA, atorId, {});

    return reply.send({
      ok: true,
      message: 'Senha redefinida. Informe ao usuário a senha temporária exibida uma única vez.',
      temporaryPassword: tempPass,
    });
  });

  app.delete<{ Params: { id: string } }>('/usuarios/:id', { preHandler: [requireGestor] }, async (request, reply) => {
    const id = request.params.id;
    const auth = request.auth!;
    if (auth.userId === id) {
      return reply.status(403).send({ error: 'Não é possível excluir o próprio usuário.' });
    }

    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Usuário não encontrado' });

    if (isGestorAuthRole(auth.role) && !isAdminAuthRole(auth.role)) {
      if (!gestorPodeGerenciarUsuario(auth.userId, existing)) {
        return reply.status(403).send({ error: 'Sem permissão para excluir este cadastro.' });
      }
    }

    await prisma.usuario.delete({ where: { id } });
    return reply.status(204).send();
  });
}

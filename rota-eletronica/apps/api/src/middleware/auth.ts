import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
  /** ADMIN | GESTOR | OPERADOR (= `UsuarioPerfil`). Legado: JWT `admin` = antigo mapeamento de GESTOR. */
  role: string;
  /** Primeiro município (compat). */
  municipioId?: string;
  /** Cidades de atuação do cadastro. */
  municipioIds?: string[];
  ufAtuacao?: string;
  setor?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: JwtPayload;
  }
}

/** Preenche `request.auth` se houver Bearer válido; não falha se token ausente (listagens com escopo opcional). */
export async function optionalAuthenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    request.auth = decoded;
  } catch {
    request.auth = undefined;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({ error: 'Token ausente ou inválido' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    request.auth = decoded;
  } catch {
    await reply.status(401).send({ error: 'Token inválido ou expirado' });
    return;
  }
}

/** Após authenticate: matriz por perfil (GET/PATCH `/perfil-permissoes`) — somente ADMIN. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (reply.sent) return;
  const role = request.auth?.role;
  if (!role || role !== 'ADMIN') {
    await reply.status(403).send({ error: 'Acesso restrito a administradores' });
  }
}

/** Após authenticate: módulo de usuários — apenas ADMIN ou GESTOR (não OPERADOR). Legado: JWT com role `admin` (GESTOR antigo). */
export async function requireGestor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (reply.sent) return;
  const role = request.auth?.role;
  const ok =
    role === 'ADMIN' || role === 'GESTOR' || role === 'admin';
  if (!role || !ok) {
    await reply.status(403).send({ error: 'Acesso restrito a administradores ou gestores' });
  }
}

/** GET /usuarios/:id — o próprio usuário pode ler o cadastro (ex.: painel de permissões); demais rotas seguem requireGestor. */
export async function requireGestorOrSelf(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (reply.sent) return;
  const id = (request.params as { id?: string }).id;
  if (id && request.auth?.userId === id) return;
  await requireGestor(request, reply);
}

export function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

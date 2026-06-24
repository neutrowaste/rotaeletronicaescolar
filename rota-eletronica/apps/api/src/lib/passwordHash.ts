import bcrypt from 'bcryptjs';

/** Custo bcrypt (recomendado ≥ 12 em produção). Senhas nunca são gravadas em texto plano. */
export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const PREFIX = 'udenc1.';
const ALGO = 'aes-256-gcm';
const KDF_SALT = 'UrbanData-at-rest-v1';

function key32(): Buffer | null {
  const secret = process.env.AT_REST_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 16) return null;
  return scryptSync(secret, KDF_SALT, 32);
}

/**
 * Cifra texto para armazenamento no PostgreSQL (AES-256-GCM).
 * Sem `AT_REST_ENCRYPTION_KEY` (≥16 caracteres), retorna o texto em claro (compatível com ambientes de dev).
 */
export function encryptAtRest(plaintext: string): string {
  const key = key32();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptAtRest(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = key32();
  if (!key) return '';
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  if (raw.length < 12 + 16) return '';
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

import { createWriteStream } from 'node:fs';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Diretório persistente para brasões enviados (fora de `public` do front). */
export function getBrasoesDir(): string {
  return path.join(__dirname, '..', '..', 'uploads', 'brasoes');
}

export async function ensureBrasoesDir(): Promise<void> {
  await mkdir(getBrasoesDir(), { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/svg+xml': '.svg',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function extFromMime(mimetype: string): string | null {
  const key = mimetype.toLowerCase().split(';')[0].trim();
  return MIME_TO_EXT[key] ?? null;
}

export function extFromFilename(filename: string): string | null {
  const m = filename.match(/\.(svg|jpe?g|png|webp)$/i);
  if (!m) return null;
  const e = m[1].toLowerCase();
  return e === 'jpeg' ? '.jpg' : `.${e}`;
}

export function resolveBrasaoExtension(mimetype: string, filename: string): string | null {
  return extFromMime(mimetype) ?? extFromFilename(filename);
}

/** Remove arquivos antigos deste município (prefixo muni-{id}-), exceto o arquivo recém-criado. */
export async function removePreviousUploads(municipalityId: string, keepFilename?: string): Promise<void> {
  const dir = getBrasoesDir();
  const prefix = `muni-${municipalityId}-`;
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    files
      .filter((f) => f.startsWith(prefix) && f !== keepFilename)
      .map((f) => unlink(path.join(dir, f)).catch(() => undefined))
  );
}

export async function saveBrasaoStream(params: {
  municipalityId: string;
  ext: string;
  fileStream: NodeJS.ReadableStream;
}): Promise<string> {
  await ensureBrasoesDir();
  const safeExt = params.ext.startsWith('.') ? params.ext : `.${params.ext}`;
  const name = `muni-${params.municipalityId}-${Date.now()}-${randomBytes(6).toString('hex')}${safeExt}`;
  const full = path.join(getBrasoesDir(), name);
  const ws = createWriteStream(full);
  await pipeline(params.fileStream, ws);
  return name;
}

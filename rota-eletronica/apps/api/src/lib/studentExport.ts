// @ts-expect-error archiver v8 exporta ZipArchive (tipos @types/archiver legados)
import { ZipArchive } from 'archiver';
import { PassThrough } from 'node:stream';
import {
  SEM_FOTO,
  buildPhotoFileName,
  isRealStudentPhoto,
  type StudentExportRow,
} from './studentCsv.js';
import { buildStudentsExcelBuffer, STUDENT_EXCEL_FILENAME } from './studentExcel.js';

export { SEM_FOTO, STUDENT_IMPORT_HEADERS, STUDENT_EXPORT_HEADERS, STUDENT_EXCEL_HEADERS, CSV_HEADERS } from './studentCsv.js';
export type { StudentExportRow } from './studentCsv.js';

export { isRealStudentPhoto } from './studentCsv.js';

export async function decodePhotoBuffer(photo: string): Promise<Buffer | null> {
  const p = photo.trim();
  if (!isRealStudentPhoto(p)) return null;

  const dataMatch = p.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
  if (dataMatch) {
    try {
      return Buffer.from(dataMatch[1], 'base64');
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(p)) {
    try {
      const res = await fetch(p, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function buildStudentsExportZip(rows: StudentExportRow[]): Promise<Buffer> {
  const excelBuffer = await buildStudentsExcelBuffer(rows);
  const usedNames = new Set<string>();

  return new Promise((resolve, reject) => {
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(passthrough);
    archive.append(excelBuffer, { name: STUDENT_EXCEL_FILENAME });

    void (async () => {
      try {
        for (const row of rows) {
          if (!isRealStudentPhoto(row.photo)) continue;
          let fileName = buildPhotoFileName(row.registrationNumber, row.name);
          if (usedNames.has(fileName)) {
            const base = fileName.replace(/\.jpg$/i, '');
            let n = 2;
            while (usedNames.has(`${base}_${n}.jpg`)) n += 1;
            fileName = `${base}_${n}.jpg`;
          }
          usedNames.add(fileName);

          const buffer = await decodePhotoBuffer(row.photo);
          if (buffer?.length) {
            archive.append(buffer, { name: `fotos/${fileName}` });
          }
        }
        await archive.finalize();
      } catch (err) {
        archive.abort();
        reject(err);
      }
    })();
  });
}

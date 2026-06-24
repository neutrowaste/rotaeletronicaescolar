/** Contrato da planilha de exportação/importação de alunos (Excel .xlsx). */

import type {
  Student as PrismaStudent,
  Municipality,
  School,
  Route,
} from '../../node_modules/.prisma/api-client/index.js';

export type StudentExportRow = PrismaStudent & {
  school: Pick<School, 'name'>;
  municipality: Pick<Municipality, 'name' | 'state' | 'ibgeCode'>;
  route?: Pick<Route, 'name'> | null;
};

export const SEM_FOTO = 'SEM_FOTO';
export const CELL_EMPTY = '-';
/** @deprecated use CELL_EMPTY */
export const CSV_EMPTY = CELL_EMPTY;

export const STUDENT_EXCEL_FILENAME = 'alunos.xlsx';

/** Colunas exigidas na planilha de importação em lote. */
export const STUDENT_IMPORT_HEADERS = [
  'Nome completo',
  'Matrícula',
  'Data de nascimento',
  'Série',
  'Turno',
  'Status',
  'Estado (UF)',
  'Município',
  'Código IBGE',
  'Escola',
  'CEP',
  'Rua',
  'Bairro',
  'Número',
  'Nome do responsável',
  'Parentesco',
  'CPF',
  'Telefone',
  'E-mail',
  'Necessidades especiais',
  'Descrição necessidades especiais',
  'Nome do arquivo da foto',
] as const;

/** Colunas adicionais apenas na exportação (endereço, coordenadas e trajeto). */
export const STUDENT_EXPORT_EXTRA_HEADERS = [
  'Endereço completo',
  'Latitude do endereço',
  'Longitude do endereço',
  'Trajeto',
  'Parada e rota (casa do aluno)',
  'Desembarque/embarque na escola',
  'Latitude da parada',
  'Longitude da parada',
] as const;

/** Cabeçalho completo da planilha gerada na exportação. */
export const STUDENT_EXPORT_HEADERS = [
  ...STUDENT_IMPORT_HEADERS,
  ...STUDENT_EXPORT_EXTRA_HEADERS,
] as const;

/** @deprecated use STUDENT_IMPORT_HEADERS */
export const STUDENT_EXCEL_HEADERS = STUDENT_IMPORT_HEADERS;

/** Alias legado */
export const CSV_HEADERS = STUDENT_IMPORT_HEADERS;

export type StudentImportHeader = (typeof STUDENT_IMPORT_HEADERS)[number];
export type StudentExcelHeader = StudentImportHeader;
export type StudentExcelRecord = Partial<Record<StudentImportHeader, string>>;
/** @deprecated */
export type StudentCsvHeader = StudentExcelHeader;
/** @deprecated */
export type StudentCsvRecord = StudentExcelRecord;

const SHIFT_FROM_LABEL: Record<string, string> = {
  manhã: 'morning',
  manha: 'morning',
  tarde: 'afternoon',
  integral: 'integral',
  noite: 'integral',
  morning: 'morning',
  afternoon: 'afternoon',
};

const STATUS_FROM_LABEL: Record<string, string> = {
  ativo: 'active',
  inativo: 'inactive',
  transferido: 'transferred',
  active: 'active',
  inactive: 'inactive',
  transferred: 'transferred',
};

export function isCellEmpty(value: string | null | undefined): boolean {
  const t = String(value ?? '').trim();
  return !t || t === CELL_EMPTY;
}

/** @deprecated use isCellEmpty */
export const isCsvEmpty = isCellEmpty;

export function cellValue(value: string | null | undefined): string {
  const t = String(value ?? '').trim();
  return isCellEmpty(t) ? '' : t;
}

/** @deprecated use cellValue */
export const csvCellValue = cellValue;

export function formatCellField(value: string | null | undefined): string {
  const t = String(value ?? '').trim();
  if (!t || t === CELL_EMPTY) return CELL_EMPTY;
  return t;
}

/** @deprecated */
export const formatCsvField = formatCellField;

export function parseDateBrToIso(value: string): string {
  const t = cellValue(value);
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

export function parseShiftFromLabel(value: string): string {
  const t = cellValue(value).toLowerCase();
  if (!t) return 'morning';
  return SHIFT_FROM_LABEL[t] ?? 'morning';
}

/** @deprecated */
export const parseShiftFromCsv = parseShiftFromLabel;

export function parseStatusFromLabel(value: string): string {
  const t = cellValue(value).toLowerCase();
  if (!t) return 'active';
  return STATUS_FROM_LABEL[t] ?? 'active';
}

/**
 * Importação: célula vazia ou "-" não recebe valor padrão.
 * Retorna "-" e flags para alerta/erro de validação.
 */
export function parseOptionalImportBirthDate(value: string): {
  value: string;
  missing: boolean;
  invalid: boolean;
} {
  const raw = cellValue(value);
  if (!raw) return { value: CELL_EMPTY, missing: true, invalid: false };
  const iso = parseDateBrToIso(value);
  if (!iso) return { value: CELL_EMPTY, missing: false, invalid: true };
  return { value: iso, missing: false, invalid: false };
}

export function parseOptionalImportStatus(value: string): {
  value: string;
  missing: boolean;
  invalid: boolean;
} {
  const raw = cellValue(value);
  if (!raw) return { value: CELL_EMPTY, missing: true, invalid: false };
  const mapped = STATUS_FROM_LABEL[raw.toLowerCase()];
  if (!mapped) return { value: CELL_EMPTY, missing: false, invalid: true };
  return { value: mapped, missing: false, invalid: false };
}

/** @deprecated */
export const parseStatusFromCsv = parseStatusFromLabel;

export function parseSpecialNeeds(value: string): boolean {
  const t = cellValue(value).toLowerCase();
  return t === 'sim' || t === 's' || t === 'true' || t === '1';
}

export function formatDateBr(iso: string): string {
  const raw = (iso ?? '').trim();
  if (!raw) return CELL_EMPTY;
  const datePart = raw.includes('T') ? raw.slice(0, 10) : raw;
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return formatCellField(raw);
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  integral: 'Integral',
  night: 'Noite',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  transferred: 'Transferido',
};

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_');
}

export function isRealStudentPhoto(photo: string | null | undefined): boolean {
  const p = (photo ?? '').trim();
  if (!p) return false;
  if (p.includes('ui-avatars.com')) return false;
  return true;
}

export function buildPhotoFileName(registrationNumber: string, studentName: string): string {
  const mat = sanitizeFilePart(registrationNumber) || 'SEM_MATRICULA';
  const nome = studentName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'ALUNO';
  return `${mat}_${nome}.jpg`;
}

/** Normaliza CEP para 8 dígitos (Excel costuma remover zero à esquerda ao salvar como número). */
export function normalizeCepDigits(raw: string | number | null | undefined): string {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
  if (!digits) return '';
  return digits.padStart(8, '0');
}

export function formatCepForAddress(rawCep: string): string {
  const digits = normalizeCepDigits(rawCep);
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function datedStudentZipName(prefix: 'exportacao' | 'importacao', date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${prefix}.alunos_${d}_${m}_${y}.zip`;
}

export function isSameStudentAddress(existingAddress: string, newAddress: string): boolean {
  const norm = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  const a = norm(existingAddress);
  const b = norm(newAddress);
  return a.length > 0 && b.length > 0 && a === b;
}

export function buildStudentExportZipFilename(date = new Date()): string {
  return datedStudentZipName('exportacao', date);
}

export const STUDENT_EXPORT_ZIP_PATTERN_LABEL = 'exportacao.alunos_dd_mm_aaaa.zip' as const;
export const STUDENT_IMPORT_ZIP_PATTERN_LABEL = 'importacao.alunos_dd_mm_aaaa.zip' as const;

export function buildStudentAddress(parts: {
  street: string;
  number: string;
  neighborhood: string;
  municipalityName: string;
  state: string;
  cep: string;
}): string {
  const segments = [parts.street, parts.number, parts.neighborhood].filter(Boolean);
  if (parts.municipalityName) segments.push(parts.municipalityName, parts.state);
  const formattedCep = formatCepForAddress(parts.cep);
  if (formattedCep) segments.push(formattedCep);
  return segments.join(', ') || '-';
}

export function normalizeExcelHeaders(headers: string[]): string[] {
  return headers.map((h) => String(h ?? '').trim());
}

export function formatCoordinate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return CELL_EMPTY;
  return String(value);
}

export const STUDENT_IMPORT_HEADER_ERROR_MESSAGE =
  'Arquivo não compatível. Favor utilizar o arquivo modelo fornecido pelo sistema.';

export function validateImportExcelHeaders(headers: string[]): void {
  const normalized = normalizeExcelHeaders(headers);
  const expected = [...STUDENT_IMPORT_HEADERS];
  if (normalized.length < expected.length) {
    throw new Error(STUDENT_IMPORT_HEADER_ERROR_MESSAGE);
  }
  if (!expected.every((h, i) => normalized[i] === h)) {
    throw new Error(STUDENT_IMPORT_HEADER_ERROR_MESSAGE);
  }
}

/** @deprecated use validateImportExcelHeaders */
export const validateExcelHeaders = validateImportExcelHeaders;

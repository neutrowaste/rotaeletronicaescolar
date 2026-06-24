import ExcelJS from 'exceljs';

import {

  type StudentExportRow,

  CELL_EMPTY,

  SEM_FOTO,

  STUDENT_EXCEL_FILENAME,

  STUDENT_EXPORT_HEADERS,

  STUDENT_IMPORT_HEADERS,

  SHIFT_LABELS,

  STATUS_LABELS,

  buildPhotoFileName,

  cellValue,

  formatCellField,

  formatCoordinate,

  formatDateBr,

  isRealStudentPhoto,

  normalizeCepDigits,

  validateImportExcelHeaders,

  type StudentExcelRecord,

} from './studentCsv.js';

import { geocodeAddress, type GeocodeResult } from './geocodeService.js';



type Responsible = {

  name?: string;

  relationship?: string;

  cpf?: string;

  phone?: string;

  email?: string;

};



type BoardingPoint = {
  address?: string;
  cep?: string;
  coordinates?: { lat?: number; lng?: number };
  homeCoordinates?: { lat?: number; lng?: number };
};



type AlightingPoint = {

  address?: string;

  coordinates?: { lat?: number; lng?: number };

};



function parseAddressFields(address?: string) {

  if (!address || address === '-') {

    return { cep: '', street: '', number: '', neighborhood: '' };

  }

  const cepMatch = address.match(/(\d{5})-?(\d{3})/);

  const cep = cepMatch ? cepMatch[0].replace(/\D/g, '') : '';

  const addressWithoutCep = cepMatch

    ? address.replace(cepMatch[0], '').replace(/\s{2,}/g, ' ').trim()

    : address;

  const parts = addressWithoutCep.split(',').map((p) => p.trim()).filter(Boolean);

  return {

    cep,

    street: parts[0] ?? '',

    number: parts[1] ?? '',

    neighborhood: parts[2] ?? '',

  };

}



function excelCellToString(value: ExcelJS.CellValue): string {

  if (value == null || value === '') return '';

  if (value instanceof Date) {

    const d = value.getDate().toString().padStart(2, '0');

    const m = (value.getMonth() + 1).toString().padStart(2, '0');

    const y = value.getFullYear();

    return `${d}/${m}/${y}`;

  }

  if (typeof value === 'object') {

    if ('result' in value && value.result != null) return excelCellToString(value.result as ExcelJS.CellValue);

    if ('text' in value && value.text != null) return String(value.text).trim();

    if ('richText' in value && Array.isArray(value.richText)) {

      return value.richText.map((r) => r.text ?? '').join('').trim();

    }

  }

  if (typeof value === 'number') {

    return String(value);

  }

  return String(value).trim();

}



function hasValidCoordinates(coords?: { lat?: number; lng?: number }): coords is { lat: number; lng: number } {
  return (
    coords?.lat != null &&
    coords?.lng != null &&
    !Number.isNaN(coords.lat) &&
    !Number.isNaN(coords.lng)
  );
}



/** Usa homeCoordinates salvo ou geocodifica o endereço (alunos legados sem o campo). */
async function resolveHomeCoordinates(
  row: StudentExportRow,
  cache: Map<string, GeocodeResult | null>
): Promise<{ lat?: number; lng?: number }> {
  const boarding = (row.boardingPoint ?? {}) as BoardingPoint;
  if (hasValidCoordinates(boarding.homeCoordinates)) {
    return boarding.homeCoordinates;
  }
  const address = cellValue(row.address);
  if (!address) return {};
  if (cache.has(address)) {
    return cache.get(address) ?? {};
  }
  const geo = await geocodeAddress(address);
  cache.set(address, geo);
  return geo ?? {};
}



function studentToImportExcelCells(row: StudentExportRow, photoFileName: string): string[] {

  const boarding = (row.boardingPoint ?? {}) as BoardingPoint;

  const responsible = (row.responsible ?? {}) as Responsible;

  const parsed = parseAddressFields(row.address);

  const cep = boarding.cep?.replace(/\D/g, '') || parsed.cep;



  return [

    formatCellField(row.name),

    formatCellField(row.registrationNumber),

    formatDateBr(row.birthDate),

    formatCellField(row.grade),

    formatCellField(SHIFT_LABELS[row.shift] ?? row.shift),

    formatCellField(STATUS_LABELS[row.status] ?? row.status),

    formatCellField(row.municipality.state),

    formatCellField(row.municipality.name),

    formatCellField(row.municipality.ibgeCode),

    formatCellField(row.school.name),

    cep ? normalizeCepDigits(cep) : CELL_EMPTY,

    formatCellField(parsed.street),

    formatCellField(parsed.neighborhood),

    formatCellField(parsed.number),

    formatCellField(responsible.name),

    formatCellField(responsible.relationship),

    formatCellField(responsible.cpf),

    formatCellField(responsible.phone),

    formatCellField(responsible.email),

    row.specialNeeds ? 'Sim' : 'Não',

    formatCellField(row.specialNeedsDesc),

    photoFileName,

  ];

}



export function studentToExcelRow(
  row: StudentExportRow,
  photoFileName: string,
  homeCoords: { lat?: number; lng?: number } = {}
): string[] {
  const boarding = (row.boardingPoint ?? {}) as BoardingPoint;
  const alighting = (row.alightingPoint ?? {}) as AlightingPoint;
  const stopCoords = boarding.coordinates ?? {};
  let homeLat: number | undefined;
  let homeLng: number | undefined;
  if (hasValidCoordinates(homeCoords)) {
    homeLat = homeCoords.lat;
    homeLng = homeCoords.lng;
  } else if (hasValidCoordinates(boarding.homeCoordinates)) {
    homeLat = boarding.homeCoordinates.lat;
    homeLng = boarding.homeCoordinates.lng;
  }

  return [
    ...studentToImportExcelCells(row, photoFileName),
    formatCellField(row.address),
    formatCoordinate(homeLat),
    formatCoordinate(homeLng),
    formatCellField(row.route?.name),
    formatCellField(boarding.address),
    formatCellField(alighting.address),
    formatCoordinate(stopCoords.lat),
    formatCoordinate(stopCoords.lng),
  ];
}



export async function buildStudentsExcelBuffer(rows: StudentExportRow[]): Promise<Buffer> {

  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Rota Eletrônica Escolar';

  const sheet = workbook.addWorksheet('Alunos', {

    views: [{ state: 'frozen', ySplit: 1 }],

  });



  sheet.addRow([...STUDENT_EXPORT_HEADERS]);

  const headerRow = sheet.getRow(1);

  headerRow.font = { bold: true };

  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };



  const cepColIndex = STUDENT_IMPORT_HEADERS.indexOf('CEP') + 1;

  const geocodeCache = new Map<string, GeocodeResult | null>();

  for (const row of rows) {

    const photoFileName = isRealStudentPhoto(row.photo)

      ? buildPhotoFileName(row.registrationNumber, row.name)

      : SEM_FOTO;

    const homeCoords = await resolveHomeCoordinates(row, geocodeCache);

    const added = sheet.addRow(studentToExcelRow(row, photoFileName, homeCoords));

    if (cepColIndex > 0) {

      const cepCell = added.getCell(cepColIndex);

      cepCell.numFmt = '@';

    }

  }



  sheet.columns.forEach((col, i) => {

    const header = STUDENT_EXPORT_HEADERS[i] ?? '';

    col.width = Math.min(42, Math.max(header.length + 2, 12));

  });



  const arrayBuffer = await workbook.xlsx.writeBuffer();

  return Buffer.from(arrayBuffer);

}



export async function parseExcelBuffer(buffer: Buffer): Promise<{

  headers: string[];

  records: StudentExcelRecord[];

}> {

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];

  if (!sheet) {

    throw new Error('Planilha vazia: não foi possível ler alunos.xlsx.');

  }



  const headerRow = sheet.getRow(1);
  const importHeaderCells = STUDENT_IMPORT_HEADERS.map((_, idx) =>
    excelCellToString(headerRow.getCell(idx + 1).value)
  );
  validateImportExcelHeaders(importHeaderCells);

  const records: StudentExcelRecord[] = [];

  const rowCount = sheet.rowCount;

  for (let r = 2; r <= rowCount; r++) {

    const row = sheet.getRow(r);

    const hasData = STUDENT_IMPORT_HEADERS.some((_, idx) =>

      cellValue(excelCellToString(row.getCell(idx + 1).value)).length > 0

    );

    if (!hasData) continue;



    const rec: StudentExcelRecord = {};

    STUDENT_IMPORT_HEADERS.forEach((header, idx) => {

      const cell = row.getCell(idx + 1);

      let value = excelCellToString(cell.value);

      if (header === 'CEP') value = normalizeCepDigits(value);

      rec[header] = value;

    });

    records.push(rec);

  }



  if (records.length === 0) {

    throw new Error('A planilha deve conter cabeçalho e ao menos uma linha de aluno.');

  }



  return { headers: [...importHeaderCells], records };

}



export { STUDENT_EXCEL_FILENAME };



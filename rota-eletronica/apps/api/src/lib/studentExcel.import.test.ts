import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { STUDENT_EXPORT_HEADERS, STUDENT_IMPORT_HEADERS } from './studentCsv.js';
import { buildStudentsExcelBuffer, parseExcelBuffer } from './studentExcel.js';

const sampleRow = {
  id: '1',
  name: 'Maria Silva',
  registrationNumber: 'SME2026002',
  birthDate: '2015-03-10',
  grade: '5º Ano',
  shift: 'morning',
  schoolId: 's1',
  municipalityId: 'm1',
  address: 'Rua A, 10, Centro, Cidade, SP, 12345-678',
  boardingPoint: {
    address: 'Parada 1',
    coordinates: { lat: -23.5, lng: -46.6 },
    cep: '12345678',
  },
  alightingPoint: { address: 'Escola X', coordinates: { lat: -23.5, lng: -46.6 } },
  responsible: {
    name: 'João',
    relationship: 'Pai',
    cpf: '123.456.789-00',
    phone: '(11) 99999-9999',
    email: 'joao@test.com',
  },
  specialNeeds: false,
  specialNeedsDesc: null,
  routeId: 'route-1',
  status: 'active',
  photo: 'https://ui-avatars.com/api/?name=Maria',
  createdAt: new Date(),
  updatedAt: new Date(),
  school: { name: 'Escola Municipal' },
  municipality: { name: 'Cidade', state: 'SP', ibgeCode: '3550308' },
  route: { name: 'Rota Centro' },
};

async function buildImportOnlyBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Alunos');
  sheet.addRow([...STUDENT_IMPORT_HEADERS]);
  sheet.addRow([
    'Maria Silva',
    'SME2026002',
    '10/03/2015',
    '5º Ano',
    'Manhã',
    'Ativo',
    'SP',
    'Cidade',
    '3550308',
    'Escola Municipal',
    '12345678',
    'Rua A',
    'Centro',
    '10',
    'João',
    'Pai',
    '123.456.789-00',
    '(11) 99999-9999',
    'joao@test.com',
    'Não',
    '-',
    'SEM_FOTO',
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildExportBufferWithoutExtraColumns(): Promise<Buffer> {
  const exportBuf = await buildStudentsExcelBuffer([sampleRow]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exportBuf);
  const sheet = workbook.worksheets[0]!;
  const extraCount = STUDENT_EXPORT_HEADERS.length - STUDENT_IMPORT_HEADERS.length;
  const firstExtraCol = STUDENT_IMPORT_HEADERS.length + 1;
  sheet.spliceColumns(firstExtraCol, extraCount);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('parseExcelBuffer importação flexível', () => {
  it('aceita planilha exportada com colunas extras de trajeto à direita', async () => {
    const buf = await buildStudentsExcelBuffer([sampleRow]);
    const { records, headers } = await parseExcelBuffer(buf);
    expect(headers).toHaveLength(STUDENT_IMPORT_HEADERS.length);
    expect(records).toHaveLength(1);
    expect(records[0]['Matrícula']).toBe('SME2026002');
    expect(records[0]['Escola']).toBe('Escola Municipal');
  });

  it('aceita planilha só com as 22 colunas de importação', async () => {
    const buf = await buildImportOnlyBuffer();
    const { records } = await parseExcelBuffer(buf);
    expect(records).toHaveLength(1);
    expect(records[0]['Nome completo']).toBe('Maria Silva');
    expect(records[0]['Turno']).toBe('Manhã');
  });

  it('aceita exportação após remoção manual das colunas extras', async () => {
    const buf = await buildExportBufferWithoutExtraColumns();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    expect(workbook.worksheets[0]!.columnCount).toBe(STUDENT_IMPORT_HEADERS.length);

    const { records } = await parseExcelBuffer(buf);
    expect(records).toHaveLength(1);
    expect(records[0]['Matrícula']).toBe('SME2026002');
  });
});

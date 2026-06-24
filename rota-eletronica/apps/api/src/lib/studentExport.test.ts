import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildPhotoFileName,
  STUDENT_EXPORT_HEADERS,
  STUDENT_IMPORT_HEADERS,
} from './studentCsv.js';
import { buildStudentsExcelBuffer, parseExcelBuffer } from './studentExcel.js';
import { isRealStudentPhoto } from './studentExport.js';
import * as geocodeService from './geocodeService.js';

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
    address: 'Parada 1 - Rua das Flores',
    coordinates: { lat: -23.5, lng: -46.6 },
    homeCoordinates: { lat: -23.52, lng: -46.62 },
    cep: '12345678',
  },
  alightingPoint: { address: 'Escola Municipal X', coordinates: { lat: -23.51, lng: -46.61 } },
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
  route: { name: 'Rota Centro - Manhã' },
};

describe('studentExport', () => {
  it('buildPhotoFileName padroniza matrícula e nome', () => {
    expect(buildPhotoFileName('SME2026001', 'Gabriel Henrique da Costa')).toBe(
      'SME2026001_GABRIEL_HENRIQUE_DA_COSTA.jpg'
    );
  });

  it('isRealStudentPhoto ignora placeholder ui-avatars', () => {
    expect(isRealStudentPhoto('https://ui-avatars.com/api/?name=Test')).toBe(false);
    expect(isRealStudentPhoto('data:image/jpeg;base64,abcd')).toBe(true);
  });

  it('buildStudentsExcelBuffer gera exportação completa com colunas de trajeto', async () => {
    const buf = await buildStudentsExcelBuffer([sampleRow]);
    const { records } = await parseExcelBuffer(buf);
    expect(STUDENT_IMPORT_HEADERS).toHaveLength(22);
    expect(STUDENT_EXPORT_HEADERS).toHaveLength(30);
    expect(records).toHaveLength(1);
    expect(records[0]['Matrícula']).toBe('SME2026002');
    expect(records[0]['Data de nascimento']).toBe('10/03/2015');
    expect(records[0]['Turno']).toBe('Manhã');
    expect(records[0]['Nome do arquivo da foto']).toBe('SEM_FOTO');
  });

  it('exportação inclui endereço completo, trajeto, paradas e coordenadas', async () => {
    const buf = await buildStudentsExcelBuffer([sampleRow]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    const row = workbook.worksheets[0]!.getRow(2);
    const cellText = (header: (typeof STUDENT_EXPORT_HEADERS)[number]) => {
      const cell = row.getCell(STUDENT_EXPORT_HEADERS.indexOf(header) + 1);
      const v = cell.value;
      return v == null ? '' : String(v);
    };

    expect(cellText('Endereço completo')).toBe('Rua A, 10, Centro, Cidade, SP, 12345-678');
    expect(cellText('Latitude do endereço')).toBe('-23.52');
    expect(cellText('Longitude do endereço')).toBe('-46.62');
    expect(cellText('Trajeto')).toBe('Rota Centro - Manhã');
    expect(cellText('Parada e rota (casa do aluno)')).toBe('Parada 1 - Rua das Flores');
    expect(cellText('Desembarque/embarque na escola')).toBe('Escola Municipal X');
    expect(cellText('Latitude da parada')).toBe('-23.5');
    expect(cellText('Longitude da parada')).toBe('-46.6');
  });

  it('exportação geocodifica endereço quando homeCoordinates não está no banco', async () => {
    const geoSpy = vi.spyOn(geocodeService, 'geocodeAddress').mockResolvedValue({
      lat: -22.1234,
      lng: -47.5678,
    });

    const legacyRow = {
      ...sampleRow,
      boardingPoint: {
        address: 'Parada 1 - Rua das Flores',
        coordinates: { lat: -23.5, lng: -46.6 },
        cep: '12345678',
      },
    };

    const buf = await buildStudentsExcelBuffer([legacyRow]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    const row = workbook.worksheets[0]!.getRow(2);
    const cellText = (header: (typeof STUDENT_EXPORT_HEADERS)[number]) => {
      const cell = row.getCell(STUDENT_EXPORT_HEADERS.indexOf(header) + 1);
      const v = cell.value;
      return v == null ? '' : String(v);
    };

    expect(cellText('Latitude do endereço')).toBe('-22.1234');
    expect(cellText('Longitude do endereço')).toBe('-47.5678');
    expect(geoSpy).toHaveBeenCalledWith('Rua A, 10, Centro, Cidade, SP, 12345-678');

    geoSpy.mockRestore();
  });
});

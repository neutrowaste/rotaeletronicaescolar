import { describe, expect, it } from 'vitest';
import {
  STUDENT_IMPORT_HEADERS,
  STUDENT_IMPORT_HEADER_ERROR_MESSAGE,
  parseDateBrToIso,
  parseShiftFromLabel,
  isCellEmpty,
  cellValue,
  parseOptionalImportBirthDate,
  parseOptionalImportStatus,
  isSameStudentAddress,
  validateImportExcelHeaders,
} from './studentCsv.js';

describe('studentCsv', () => {
  it('parseDateBrToIso converte dd/MM/yyyy', () => {
    expect(parseDateBrToIso('10/03/2015')).toBe('2015-03-10');
    expect(parseDateBrToIso('-')).toBe('');
  });

  it('parseShiftFromLabel aceita rótulos em português', () => {
    expect(parseShiftFromLabel('Manhã')).toBe('morning');
    expect(parseShiftFromLabel('Tarde')).toBe('afternoon');
  });

  it('isCellEmpty trata traço como vazio', () => {
    expect(isCellEmpty('-')).toBe(true);
    expect(cellValue('-')).toBe('');
  });

  it('validateImportExcelHeaders exige as 22 colunas de importação na ordem correta', () => {
    expect(() => validateImportExcelHeaders(['Nome completo', 'Matrícula'])).toThrow(
      STUDENT_IMPORT_HEADER_ERROR_MESSAGE
    );
    expect(() => validateImportExcelHeaders([...STUDENT_IMPORT_HEADERS])).not.toThrow();
    expect(() =>
      validateImportExcelHeaders([
        ...STUDENT_IMPORT_HEADERS,
        'Endereço completo',
        'Trajeto',
      ])
    ).not.toThrow();
    expect(() =>
      validateImportExcelHeaders(['Matrícula', 'Nome completo', ...STUDENT_IMPORT_HEADERS.slice(2)])
    ).toThrow(STUDENT_IMPORT_HEADER_ERROR_MESSAGE);
  });

  it('parseOptionalImportBirthDate não inventa data quando célula está vazia', () => {
    expect(parseOptionalImportBirthDate('-')).toEqual({
      value: '-',
      missing: true,
      invalid: false,
    });
    expect(parseOptionalImportBirthDate('10/03/2015')).toEqual({
      value: '2015-03-10',
      missing: false,
      invalid: false,
    });
    expect(parseOptionalImportBirthDate('data inválida').invalid).toBe(true);
  });

  it('parseOptionalImportStatus não assume Ativo quando célula está vazia', () => {
    expect(parseOptionalImportStatus('-')).toEqual({
      value: '-',
      missing: true,
      invalid: false,
    });
    expect(parseOptionalImportStatus('Ativo')).toEqual({
      value: 'active',
      missing: false,
      invalid: false,
    });
    expect(parseOptionalImportStatus('xyz').invalid).toBe(true);
  });

  it('isSameStudentAddress compara endereços ignorando maiúsculas e acentos', () => {
    expect(
      isSameStudentAddress(
        'Rua A, 10, Centro, Cidade, SP, 12345-678',
        'rua a, 10, centro, cidade, sp, 12345-678'
      )
    ).toBe(true);
    expect(
      isSameStudentAddress('Rua A, 10, Centro, Cidade, SP', 'Rua B, 20, Centro, Cidade, SP')
    ).toBe(false);
  });
});

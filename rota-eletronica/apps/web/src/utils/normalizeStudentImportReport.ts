import type { StudentImportReport } from '@/types/studentImportReport';

type LegacyImportError = {
  line: number;
  registrationNumber?: string;
  message: string;
};

type RawImportResponse = {
  totalEnviados?: number;
  totalImportados?: number;
  totalCriados?: number;
  totalAtualizados?: number;
  totalImportadosAlertas?: number;
  totalNaoImportados?: number;
  registros?: StudentImportReport['registros'];
  total?: number;
  created?: number;
  updated?: number;
  failed?: number;
  errors?: LegacyImportError[];
};

/** Normaliza resposta da API (inclui formato legado) para o relatório do modal. */
export function normalizeStudentImportReport(data: RawImportResponse): StudentImportReport {
  if (typeof data.totalEnviados === 'number' && Array.isArray(data.registros)) {
    return {
      totalEnviados: data.totalEnviados,
      totalImportados: data.totalImportados ?? 0,
      totalCriados: data.totalCriados ?? 0,
      totalAtualizados: data.totalAtualizados ?? 0,
      totalImportadosAlertas: data.totalImportadosAlertas ?? 0,
      totalNaoImportados: data.totalNaoImportados ?? 0,
      registros: data.registros,
    };
  }

  const total = data.total ?? 0;
  const created = data.created ?? 0;
  const updated = data.updated ?? 0;
  const failed = data.failed ?? 0;
  const errors = data.errors ?? [];

  return {
    totalEnviados: total,
    totalImportados: created + updated,
    totalCriados: created,
    totalAtualizados: updated,
    totalImportadosAlertas: 0,
    totalNaoImportados: failed,
    registros: errors.map((e) => ({
      linha: e.line,
      matricula: e.registrationNumber,
      status: 'Erro' as const,
      alertas: '-' as const,
      observacao: e.message,
    })),
  };
}

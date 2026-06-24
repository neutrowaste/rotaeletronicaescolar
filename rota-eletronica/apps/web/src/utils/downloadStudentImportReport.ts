import ExcelJS from 'exceljs';
import type { StudentImportReport } from '@/types/studentImportReport';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadStudentImportReportExcel(
  report: StudentImportReport,
  filename = `relatorio_importacao_alunos_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rota Eletrônica Escolar';

  const resumo = workbook.addWorksheet('Resumo');
  resumo.addRow(['Indicador', 'Quantidade']);
  resumo.getRow(1).font = { bold: true };
  resumo.addRows([
    ['Total enviados no arquivo', report.totalEnviados],
    ['Total importados com sucesso', report.totalImportados],
    ['Novos cadastros criados', report.totalCriados],
    ['Cadastros existentes atualizados', report.totalAtualizados],
    ['Importados com alertas', report.totalImportadosAlertas],
    ['Não importados (erro)', report.totalNaoImportados],
  ]);
  resumo.columns = [{ width: 36 }, { width: 14 }];

  const detalhes = workbook.addWorksheet('Detalhes');
  detalhes.addRow(['Linha', 'Nome do aluno', 'Matrícula', 'Status', 'Alertas', 'Observação']);
  detalhes.getRow(1).font = { bold: true };
  for (const r of report.registros) {
    detalhes.addRow([
      r.linha,
      r.nomeAluno ?? '',
      r.matricula ?? '',
      r.status,
      r.alertas ?? '-',
      r.observacao,
    ]);
  }
  detalhes.columns = [
    { width: 8 },
    { width: 32 },
    { width: 16 },
    { width: 14 },
    { width: 10 },
    { width: 56 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

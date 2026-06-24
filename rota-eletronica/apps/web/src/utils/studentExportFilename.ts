function datedZipName(prefix: string, date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  return `${prefix}.alunos_${d}_${m}_${y}.zip`;
}

/** Exportação: exportacao.alunos_dd_mm_aaaa.zip */
export function buildStudentExportZipFilename(date = new Date()): string {
  return datedZipName('exportacao', date);
}

export const STUDENT_EXPORT_ZIP_PATTERN_LABEL = 'exportacao.alunos_dd_mm_aaaa.zip';

/** Importação: importacao.alunos_dd_mm_aaaa.zip */
export const STUDENT_IMPORT_ZIP_PATTERN_LABEL = 'importacao.alunos_dd_mm_aaaa.zip';

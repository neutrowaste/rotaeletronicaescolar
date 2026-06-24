export type StudentImportRegistroStatus = 'Criado' | 'Atualizado' | 'Erro';

export type StudentImportAlertasLabel = 'Sim' | '-';

export type StudentImportRegistro = {
  linha: number;
  nomeAluno?: string;
  matricula?: string;
  status: StudentImportRegistroStatus;
  alertas: StudentImportAlertasLabel;
  observacao: string;
};

export type StudentImportReport = {
  totalEnviados: number;
  totalImportados: number;
  totalCriados: number;
  totalAtualizados: number;
  totalImportadosAlertas: number;
  totalNaoImportados: number;
  registros: StudentImportRegistro[];
};

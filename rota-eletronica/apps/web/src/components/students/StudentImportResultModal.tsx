import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';
import type { StudentImportRegistro, StudentImportReport } from '@/types/studentImportReport';
import { downloadStudentImportReportExcel } from '@/utils/downloadStudentImportReport';

type Props = {
  open: boolean;
  report: StudentImportReport | null;
  onClose: () => void;
};

const CLOSE_BTN =
  'px-4 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium border border-white/20 disabled:opacity-50';
const TABLE_WRAP =
  'rounded-lg border border-white/25 overflow-hidden';
const TABLE_HEAD = 'sticky top-0 bg-[#16566a] text-white/80 text-xs uppercase tracking-wide';
const TABLE_BODY = 'divide-y divide-white/10';
const TABLE_CELL = 'px-3 py-2 bg-white/[0.03]';
const TABLE =
  'import-result-detail-table w-full text-sm text-left text-white selection:bg-urban-green/40 selection:text-white';
const DOWNLOAD_BTN =
  'px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium !text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2';

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'amber' | 'red' | 'neutral';
}) {
  const valueClass =
    accent === 'green'
      ? 'text-urban-green'
      : accent === 'amber'
        ? 'text-amber-300'
        : accent === 'red'
          ? 'text-red-300'
          : 'text-white';
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/25 p-3 min-w-0">
      <p className="text-xs text-white/70 leading-snug">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: StudentImportRegistro['status'] }) {
  const styles =
    status === 'Criado'
      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
      : status === 'Atualizado'
        ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
        : 'bg-red-500/20 text-red-200 border-red-400/40';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles}`}>
      {status}
    </span>
  );
}

export function StudentImportResultModal({ open, report, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);

  if (!open || !report) return null;

  const totalEnviados = report.totalEnviados ?? 0;
  const totalImportados = report.totalImportados ?? 0;
  const totalNaoImportados = report.totalNaoImportados ?? 0;
  const registros = report.registros ?? [];

  const erros = registros.filter((r) => r.status === 'Erro');
  const nenhumEnviado = totalEnviados === 0;
  const todosOk =
    totalEnviados > 0 && totalNaoImportados === 0 && totalImportados === totalEnviados;
  const parcial = totalImportados > 0 && totalNaoImportados > 0;

  const banner = nenhumEnviado ? (
    <div className="flex gap-3 rounded-lg bg-amber-500/15 border border-amber-400/30 px-4 py-3 text-sm text-amber-100">
      <AlertTriangle className="shrink-0 mt-0.5" size={20} aria-hidden />
      <p>Nenhum registro de aluno foi encontrado no arquivo enviado. Verifique se a planilha contém dados.</p>
    </div>
  ) : todosOk ? (
    <div className="flex gap-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-100">
      <CheckCircle2 className="shrink-0 mt-0.5" size={20} aria-hidden />
      <p>
        Todos os <span className="font-medium">{totalEnviados}</span> registro(s) foram processados com
        sucesso.
        {(report.totalImportadosAlertas ?? 0) > 0 &&
          ` ${report.totalImportadosAlertas} com alerta(s) — confira as colunas Alertas e Observação.`}
      </p>
    </div>
  ) : parcial ? (
    <div className="flex gap-3 rounded-lg bg-amber-500/15 border border-amber-400/30 px-4 py-3 text-sm text-amber-100">
      <AlertTriangle className="shrink-0 mt-0.5" size={20} aria-hidden />
      <p>
        Importação concluída parcialmente:{' '}
        <span className="font-medium">{totalImportados}</span> de{' '}
        <span className="font-medium">{totalEnviados}</span> registro(s) importados;{' '}
        <span className="font-medium">{totalNaoImportados}</span> não importado(s).
      </p>
    </div>
  ) : (
    <div className="flex gap-3 rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-100">
      <AlertTriangle className="shrink-0 mt-0.5" size={20} aria-hidden />
      <p>Nenhum registro foi importado. Corrija os erros abaixo e tente novamente.</p>
    </div>
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadStudentImportReportExcel(report);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-result-title"
    >
      <div
        className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col [color:white]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 p-5 pb-3 shrink-0">
          <h2 id="import-result-title" className="text-lg font-medium">
            Resultado da importação
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/15 text-white/80 hover:text-white"
            aria-label="Fechar relatório"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {banner}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryCard label="Enviados no arquivo" value={totalEnviados} />
            <SummaryCard label="Importados com sucesso" value={totalImportados} accent="green" />
            <SummaryCard label="Novos criados" value={report.totalCriados ?? 0} accent="green" />
            <SummaryCard label="Atualizados" value={report.totalAtualizados ?? 0} accent="amber" />
            <SummaryCard label="Com alertas" value={report.totalImportadosAlertas ?? 0} accent="amber" />
            <SummaryCard label="Não importados" value={totalNaoImportados} accent="red" />
          </div>

          {erros.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-red-200 mb-2">Erros ({erros.length})</h3>
              <ul className="rounded-lg border border-red-400/30 bg-red-500/10 divide-y divide-red-400/20 max-h-48 overflow-y-auto text-sm selection:bg-urban-green/40 selection:text-white">
                {erros.map((r) => (
                  <li
                    key={`err-${r.linha}`}
                    className="px-3 py-2 text-white/90 transition-colors duration-150 hover:bg-[#1a5a72]"
                  >
                    <span className="font-medium text-red-200">Linha {r.linha}</span>
                    {r.nomeAluno ? ` — ${r.nomeAluno}` : ''}
                    {r.matricula ? ` (${r.matricula})` : ''}: {r.observacao}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-sm font-medium text-white/90 mb-2">Detalhamento dos registros</h3>
            <div className={TABLE_WRAP}>
              <div className="overflow-x-auto overflow-y-auto max-h-64">
                <table className={TABLE}>
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Nome</th>
                      <th className="px-3 py-2.5 font-medium">Matrícula</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Alertas</th>
                      <th className="px-3 py-2.5 font-medium min-w-[12rem]">Observação</th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {registros.map((r) => (
                      <tr key={`row-${r.linha}-${r.matricula ?? ''}`}>
                        <td className={`${TABLE_CELL} text-white/95`}>{r.nomeAluno ?? '—'}</td>
                        <td className={`${TABLE_CELL} text-white/95`}>{r.matricula ?? '—'}</td>
                        <td className={TABLE_CELL}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td
                          className={`${TABLE_CELL} ${
                            r.alertas === 'Sim' ? 'text-amber-300 font-medium' : 'text-white/65'
                          }`}
                        >
                          {r.alertas ?? '-'}
                        </td>
                        <td className={`${TABLE_CELL} text-white/85 text-xs`}>{r.observacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-2 justify-end p-5 pt-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className={DOWNLOAD_BTN}
          >
            <Download size={16} aria-hidden />
            {downloading ? 'Gerando...' : 'Baixar relatório (Excel)'}
          </button>
          <button type="button" onClick={onClose} className={CLOSE_BTN}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

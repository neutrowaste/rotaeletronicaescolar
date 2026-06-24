import { FileSpreadsheet, UserPlus, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onManualCreate: () => void;
  onBatchImport: () => void;
};

const OPTION_BTN =
  'flex flex-1 flex-col items-center justify-center gap-3 min-h-[140px] px-4 py-5 rounded-lg border border-white/25 bg-white/[0.03] text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.08] hover:border-white/35 hover:text-white disabled:opacity-50';

export function StudentCreateChoiceModal({ open, onClose, onManualCreate, onBatchImport }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-create-choice-title"
    >
      <div
        className="rounded-card bg-[#134D5F] border border-white/20 shadow-2xl max-w-lg w-full p-5 [color:white]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-4">
          <h2 id="student-create-choice-title" className="text-lg font-medium text-white">
            Novo aluno
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-white/80 mb-5">
          Escolha como deseja iniciar o cadastro do aluno:
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={onManualCreate} className={OPTION_BTN}>
            <UserPlus size={28} className="text-urban-green-light" aria-hidden />
            <span>Cadastrar manualmente</span>
          </button>
          <button
            type="button"
            onClick={onBatchImport}
            className={`${OPTION_BTN} hover:border-urban-green/35`}
          >
            <FileSpreadsheet size={28} className="text-urban-green-light" aria-hidden />
            <span>Importar cadastros em lote</span>
          </button>
        </div>
      </div>
    </div>
  );
}

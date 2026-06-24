import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { api } from '@/services/api';
import type { StudentImportReport } from '@/types/studentImportReport';
import { StudentImportResultModal } from '@/components/students/StudentImportResultModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

const CANCEL_BTN =
  'px-4 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium border border-white/20 disabled:opacity-50';
const CONFIRM_BTN =
  'px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium !text-white text-sm font-medium disabled:opacity-50';
const FILE_PICKER_BTN =
  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-urban-petrol/40 bg-white !text-urban-petrol hover:bg-slate-50 transition-colors mb-4 disabled:opacity-50 font-medium text-sm';

export function StudentImportModal({ open, onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upsert, setUpsert] = useState(true);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StudentImportReport | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setReport(null);
    setShowResultModal(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Selecione um arquivo .zip.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('O arquivo deve estar no formato .zip.');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setShowResultModal(false);
    try {
      const res = await api.students.importBatch(file, { upsert });
      setReport(res);
      setShowResultModal(true);
      if (res.totalImportados > 0) {
        await onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setLoading(false);
    }
  };

  const handleResultClose = () => {
    reset();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-students-title"
      >
        <div
          className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 [color:white]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 id="import-students-title" className="text-lg font-medium">
              Importar alunos
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="p-1 rounded hover:bg-white/15 text-white/80 hover:text-white disabled:opacity-50"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="text-sm text-white/90 mb-4 space-y-3">
            <p>
              Selecione um arquivo no formato{' '}
              <span className="font-medium text-white">.zip</span> contendo obrigatoriamente o arquivo{' '}
              <span className="font-medium text-white">alunos</span> e a pasta{' '}
              <span className="font-medium text-white">fotos</span> para iniciar a importação em lote.
            </p>
            <p>
              O sistema realizará automaticamente a validação dos dados, geocodificação dos endereços e
              vínculo da parada mais próxima.
            </p>
            <p>
              <span className="font-medium text-white">Campos obrigatórios para importação:</span>
              <br />
              nome completo, matrícula, série, turno, escola, endereço completo (CEP, rua, bairro e
              número), nome do responsável e telefone.
            </p>
            <p className="text-white/75 text-xs">
              Campos opcionais na planilha (data de nascimento, status, CPF, parentesco, e-mail e foto):
              se vierem vazios ou com &quot;-&quot;, o aluno é importado sem preenchimento automático e
              consta alerta no relatório para regularização posterior. Utilize o arquivo modelo do sistema
              (exportação de alunos ou planilha com as mesmas colunas iniciais); colunas extras de trajeto à
              direita, se existirem, são ignoradas na importação.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
              setReport(null);
              setShowResultModal(false);
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className={FILE_PICKER_BTN}
          >
            <Upload size={18} className="shrink-0 text-urban-petrol" aria-hidden />
            <span className="truncate">{file ? file.name : 'Selecionar arquivo .zip'}</span>
          </button>

          <label className="flex items-center gap-2 text-sm text-white/90 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={upsert}
              onChange={(e) => setUpsert(e.target.checked)}
              disabled={loading}
              className="rounded border-white/30 bg-white/5 text-urban-green focus:ring-urban-green focus:ring-offset-0"
            />
            Atualizar alunos existentes (mesmo nome e matrícula no município)
          </label>

          {error && (
            <p className="text-sm text-red-300 rounded-lg bg-red-500/15 border border-red-400/30 px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={handleClose} disabled={loading} className={CANCEL_BTN}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading || !file}
              className={CONFIRM_BTN}
            >
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </div>

      <StudentImportResultModal
        open={showResultModal}
        report={report}
        onClose={handleResultClose}
      />
    </>
  );
}

import { useId } from 'react';

type DeleteConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
  /** Texto do botão principal (padrão: Confirmar) */
  confirmLabel?: string;
  /** Texto exibido enquanto `confirming` (padrão: Excluindo…) */
  confirmingLabel?: string;
  /** Sobrescreve o estilo do botão de confirmação (ex.: redefinir senha — tom laranja) */
  confirmButtonClassName?: string;
  /** Se false, exibe apenas o botão de confirmação (ex.: mensagem informativa) */
  showCancel?: boolean;
};

const DEFAULT_CONFIRM_BTN =
  'px-4 py-2 rounded-lg bg-urban-green hover:bg-urban-green-medium text-white text-sm font-medium disabled:opacity-50';

/** Modal de confirmação centralizado (exclusão, redefinir senha, etc.). */
export function DeleteConfirmModal({
  open,
  title,
  description = 'Esta ação não poderá ser desfeita.',
  onCancel,
  onConfirm,
  confirming = false,
  confirmLabel = 'Confirmar',
  confirmingLabel = 'Excluindo…',
  confirmButtonClassName,
  showCancel = true,
}: DeleteConfirmModalProps) {
  const titleId = useId();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="rounded-card bg-sidebar border border-urban-petrol/50 shadow-xl max-w-sm w-full p-5 [color:white]"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} className="font-medium mb-1">
          {title}
        </p>
        <p className="text-sm text-white/90 mb-4">{description}</p>
        <div className="flex gap-2 justify-end">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="px-4 py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm font-medium border border-white/20 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={confirmButtonClassName ?? DEFAULT_CONFIRM_BTN}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

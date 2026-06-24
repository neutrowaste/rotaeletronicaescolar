import { AlertTriangle } from 'lucide-react';
import {
  INSPECTION_EXPIRY_BANNER_CLASS,
  INSPECTION_EXPIRY_ICON_CLASS,
  type InspectionExpiryWarning,
} from '@/utils/inspectionExpiry';

type Props = {
  warning: InspectionExpiryWarning | null;
  formatDate: (dateStr: string) => string;
};

export function InspectionExpiryBanner({ warning, formatDate }: Props) {
  if (!warning) return null;

  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 ${INSPECTION_EXPIRY_BANNER_CLASS[warning.severity]}`}
      role="status"
    >
      <AlertTriangle
        size={22}
        className={`flex-shrink-0 mt-0.5 ${INSPECTION_EXPIRY_ICON_CLASS[warning.severity]}`}
        aria-hidden
      />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {warning.severity === 'expired'
            ? 'Atenção: inspeção vencida'
            : 'Atenção: inspeção próxima do vencimento'}
        </p>
        <p className="opacity-95 mt-1">
          {warning.label}. Validade até: {formatDate(warning.expiryDate)}.
        </p>
        <p className="text-xs opacity-90 mt-2">
          O campo &quot;Última inspeção&quot; está destacado abaixo.
        </p>
      </div>
    </div>
  );
}

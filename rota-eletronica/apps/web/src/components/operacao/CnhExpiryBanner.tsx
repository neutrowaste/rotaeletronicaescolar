import { AlertTriangle } from 'lucide-react';
import {
  CNH_EXPIRY_BANNER_CLASS,
  CNH_EXPIRY_ICON_CLASS,
  type CnhExpiryWarning,
} from '@/utils/cnhExpiry';

type Props = {
  warning: CnhExpiryWarning | null;
  licenseExpiry: string;
  formatDate: (dateStr: string) => string;
};

export function CnhExpiryBanner({ warning, licenseExpiry, formatDate }: Props) {
  if (!warning) return null;

  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 ${CNH_EXPIRY_BANNER_CLASS[warning.severity]}`}
      role="status"
    >
      <AlertTriangle
        size={22}
        className={`flex-shrink-0 mt-0.5 ${CNH_EXPIRY_ICON_CLASS[warning.severity]}`}
        aria-hidden
      />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {warning.severity === 'expired'
            ? 'Atenção: CNH vencida'
            : 'Atenção: CNH próxima do vencimento'}
        </p>
        <p className="opacity-95 mt-1">
          {warning.label}. Vencimento: {formatDate(licenseExpiry)}.
        </p>
        <p className="text-xs opacity-90 mt-2">
          O campo &quot;Vencimento CNH&quot; está destacado abaixo.
        </p>
      </div>
    </div>
  );
}

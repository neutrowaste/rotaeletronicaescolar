import { AlertTriangle } from 'lucide-react';
import { INCOMPLETE_SURFACE_CLASS } from '@/utils/studentCompleteness';

type Props = {
  messages: string[];
};

export function StudentIncompleteBanner({ messages }: Props) {
  if (messages.length === 0) return null;
  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 ${INCOMPLETE_SURFACE_CLASS}`}
      role="status"
    >
      <AlertTriangle size={22} className="flex-shrink-0 text-amber-600 mt-0.5" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-amber-800">Cadastro incompleto</p>
        <p className="text-urban-gray-data mt-1">{messages.join(' · ')}</p>
        <p className="text-xs text-urban-gray-data mt-2">
          Os campos pendentes estão destacados em âmbar abaixo.
        </p>
      </div>
    </div>
  );
}

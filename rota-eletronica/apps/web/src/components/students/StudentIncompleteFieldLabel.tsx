import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  INCOMPLETE_ALERT_ICON_CLASS,
  INCOMPLETE_TEXT_CLASS,
  type StudentIncompleteField,
} from '@/utils/studentCompleteness';

type Props = {
  field: StudentIncompleteField;
  incomplete: Set<StudentIncompleteField>;
  className?: string;
  children: ReactNode;
};
export function StudentIncompleteFieldLabel({ field, incomplete, className = 'block text-xs text-urban-gray-data mb-1', children }: Props) {
  const highlight = incomplete.has(field);
  return (
    <label className={highlight ? `${className} ${INCOMPLETE_TEXT_CLASS} flex items-center gap-1` : className}>
      {highlight && <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />}
      {children}
    </label>
  );
}

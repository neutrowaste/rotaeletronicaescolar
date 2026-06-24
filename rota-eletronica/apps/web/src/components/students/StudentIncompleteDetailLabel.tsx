import { AlertTriangle } from 'lucide-react';
import {
  INCOMPLETE_ALERT_ICON_CLASS,
  type StudentIncompleteField,
} from '@/utils/studentCompleteness';

type Props = {
  field: StudentIncompleteField;
  incomplete: Set<StudentIncompleteField>;
  children: string;
};

export function StudentIncompleteDetailLabel({ field, incomplete, children }: Props) {
  const highlight = incomplete.has(field);
  return (
    <p className="text-xs mb-1 flex items-center gap-1 text-urban-gray-data">
      {highlight && <AlertTriangle size={12} className={INCOMPLETE_ALERT_ICON_CLASS} aria-hidden />}
      {children}
    </p>
  );
}

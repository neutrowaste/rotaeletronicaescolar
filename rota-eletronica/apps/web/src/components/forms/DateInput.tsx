import { useEffect, useMemo, useState } from 'react';

interface DateInputProps {
  value: string;
  onChange: (nextIso: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  /** Texto de ajuda abaixo do campo (ex.: quando obrigatório) */
  hint?: string;
  /** Oculta mensagens de validação (útil em filtros compactos) */
  suppressValidation?: boolean;
}

function toDisplay(iso: string): string {
  if (!iso) return '';
  const normalized = iso.includes('T') ? iso.slice(0, 10) : iso;
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return '';
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

function toIso(display: string): string {
  const digits = display.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return '';
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const dt = new Date(year, month - 1, day);
  const isValid =
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day;
  if (!isValid) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function DateInput({
  value,
  onChange,
  className,
  required,
  placeholder,
  readOnly,
  disabled,
  id,
  hint,
  suppressValidation = false,
}: DateInputProps) {
  const displayValue = useMemo(() => toDisplay(value), [value]);
  const [draft, setDraft] = useState(displayValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setDraft(displayValue);
  }, [displayValue]);

  const digits = digitsOnly(draft);
  const invalidComplete = digits.length === 8 && !toIso(draft);
  const errorMessage = suppressValidation
    ? null
    : invalidComplete
      ? 'Data inválida. Digite dia, mês e ano (ex.: 20-03-2026).'
      : required && touched && !value && !draft
        ? 'Informe a data.'
        : null;

  const baseId = id ?? 'date-input';
  const hintId = `${baseId}-hint`;
  const errId = `${baseId}-error`;

  return (
    <div className="w-full">
      <input
        id={baseId}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const masked = maskDate(e.target.value);
          setDraft(masked);
          setTouched(true);
          const iso = toIso(masked);
          if (iso) onChange(iso);
          if (!masked) onChange('');
        }}
        onBlur={() => setTouched(true)}
        placeholder={placeholder ?? '__/__/____'}
        className={`placeholder:font-mono placeholder:tracking-normal ${className ?? ''}`}
        required={required}
        maxLength={10}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={
          errorMessage ? errId : hint ? hintId : undefined
        }
      />
      {!suppressValidation && hint && !errorMessage && (
        <p id={hintId} className="mt-1 text-xs text-urban-gray-data">
          {hint}
        </p>
      )}
      {!suppressValidation && errorMessage && (
        <p id={errId} className="mt-1 text-xs text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Avisos de vencimento de inspeção veicular.
 * Validade = última inspeção + prazo em meses (padrão 12).
 * Alerta até 30 dias antes do vencimento (veículos ativos ou em manutenção).
 */

import type { Vehicle } from '@rota-eletronica/shared-types';
import {
  CNH_EXPIRY_BANNER_CLASS,
  CNH_EXPIRY_FIELD_CLASS,
  CNH_EXPIRY_ICON_CLASS,
  CNH_EXPIRY_VALUE_CLASS,
  type CnhExpirySeverity,
} from '@/utils/cnhExpiry';

/** Prazo de validade após a data da última inspeção (ajustável no futuro por município). */
export const INSPECTION_VALIDITY_MONTHS = 12;

const ALERT_ELIGIBLE_STATUSES: Vehicle['status'][] = ['active', 'maintenance'];

export type InspectionExpirySeverity = CnhExpirySeverity;

export interface InspectionExpiryWarning {
  label: string;
  severity: InspectionExpirySeverity;
  /** Data de vencimento calculada (YYYY-MM-DD). */
  expiryDate: string;
}

export {
  CNH_EXPIRY_BANNER_CLASS as INSPECTION_EXPIRY_BANNER_CLASS,
  CNH_EXPIRY_FIELD_CLASS as INSPECTION_EXPIRY_FIELD_CLASS,
  CNH_EXPIRY_ICON_CLASS as INSPECTION_EXPIRY_ICON_CLASS,
  CNH_EXPIRY_VALUE_CLASS as INSPECTION_EXPIRY_VALUE_CLASS,
};

function parseDateOnly(dateStr: string): Date | null {
  const iso = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Vencimento da inspeção = última inspeção + validade em meses. */
export function getInspectionExpiryDate(
  lastInspectionDate: string,
  validityMonths: number = INSPECTION_VALIDITY_MONTHS
): string | null {
  const inspected = parseDateOnly(lastInspectionDate);
  if (!inspected) return null;
  const expiry = new Date(inspected);
  expiry.setMonth(expiry.getMonth() + validityMonths);
  return formatDateOnly(expiry);
}

function isEligibleStatus(status: Vehicle['status']): boolean {
  return ALERT_ELIGIBLE_STATUSES.includes(status);
}

export const INSPECTION_EXPIRY_INPUT_HIGHLIGHT: Record<InspectionExpirySeverity, string> = {
  expired: 'border-red-400/60 ring-1 ring-red-400/40 bg-red-500/5 focus:ring-red-400/50',
  expiring: 'border-amber-400/60 ring-1 ring-amber-400/40 bg-amber-500/5 focus:ring-amber-400/50',
};

export const INSPECTION_EXPIRY_LABEL_CLASS: Record<InspectionExpirySeverity, string> = {
  expired: 'text-red-500',
  expiring: 'text-amber-500',
};

export function inspectionInputClass(
  baseClass: string,
  warning: InspectionExpiryWarning | null
): string {
  if (!warning) return baseClass;
  return `${baseClass} ${INSPECTION_EXPIRY_INPUT_HIGHLIGHT[warning.severity]}`;
}

export function getInspectionExpiryWarning(
  lastInspectionDate: string,
  status: Vehicle['status'],
  validityMonths: number = INSPECTION_VALIDITY_MONTHS
): InspectionExpiryWarning | null {
  if (!isEligibleStatus(status) || !lastInspectionDate) return null;

  const expiryDate = getInspectionExpiryDate(lastInspectionDate, validityMonths);
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = parseDateOnly(expiryDate);
  if (!end) return null;

  if (end < today) {
    return { label: 'Inspeção vencida', severity: 'expired', expiryDate };
  }

  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  if (end <= inThirtyDays) {
    return { label: 'Inspeção vence em até 30 dias', severity: 'expiring', expiryDate };
  }

  return null;
}

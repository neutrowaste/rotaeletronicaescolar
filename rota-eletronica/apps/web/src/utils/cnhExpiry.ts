/**
 * Avisos de vencimento de CNH: até 30 dias antes do fim (somente motoristas ativos).
 */

export type CnhExpirySeverity = 'expired' | 'expiring';

export interface CnhExpiryWarning {
  label: string;
  severity: CnhExpirySeverity;
}

export const CNH_EXPIRY_INPUT_HIGHLIGHT: Record<CnhExpirySeverity, string> = {
  expired: 'border-red-400/60 ring-1 ring-red-400/40 bg-red-500/5 focus:ring-red-400/50',
  expiring: 'border-amber-400/60 ring-1 ring-amber-400/40 bg-amber-500/5 focus:ring-amber-400/50',
};

export const CNH_EXPIRY_LABEL_CLASS: Record<CnhExpirySeverity, string> = {
  expired: 'text-red-500',
  expiring: 'text-amber-500',
};

export function cnhInputClass(baseClass: string, warning: CnhExpiryWarning | null): string {
  if (!warning) return baseClass;
  return `${baseClass} ${CNH_EXPIRY_INPUT_HIGHLIGHT[warning.severity]}`;
}

export function getCnhExpiryWarning(
  licenseExpiry: string,
  status: 'active' | 'inactive'
): CnhExpiryWarning | null {
  if (status !== 'active' || !licenseExpiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(licenseExpiry);
  end.setHours(0, 0, 0, 0);

  if (end < today) {
    return { label: 'CNH vencida', severity: 'expired' };
  }

  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);

  if (end <= inThirtyDays) {
    return { label: 'CNH vence em até 30 dias', severity: 'expiring' };
  }

  return null;
}

export const CNH_EXPIRY_ICON_CLASS: Record<CnhExpirySeverity, string> = {
  expired: 'text-red-500',
  expiring: 'text-amber-500',
};

export const CNH_EXPIRY_BANNER_CLASS: Record<CnhExpirySeverity, string> = {
  expired: 'bg-red-100 border-red-300 text-red-800',
  expiring: 'bg-amber-50 border-amber-200 text-amber-800',
};

export const CNH_EXPIRY_FIELD_CLASS: Record<CnhExpirySeverity, string> = {
  expired: 'border-red-300 bg-red-500/10',
  expiring: 'border-amber-300 bg-amber-500/10',
};

export const CNH_EXPIRY_VALUE_CLASS: Record<CnhExpirySeverity, string> = {
  expired: 'text-red-400',
  expiring: 'text-amber-400',
};

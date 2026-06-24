/**
 * Avisos de vencimento de contrato: 6, 3 e 1 mês antes do fim.
 */

export type ContractExpirySeverity = 'expired' | '1month' | '3months' | '6months';

export interface ContractExpiryWarning {
  label: string;
  severity: ContractExpirySeverity;
}

export function getContractExpiryWarning(contractEnd: string): ContractExpiryWarning | null {
  if (!contractEnd) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(contractEnd);
  end.setHours(0, 0, 0, 0);

  if (end < today) {
    return { label: 'Contrato vencido', severity: 'expired' };
  }

  const inOneMonth = new Date(today);
  inOneMonth.setMonth(inOneMonth.getMonth() + 1);
  const inThreeMonths = new Date(today);
  inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
  const inSixMonths = new Date(today);
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);

  if (end <= inOneMonth) return { label: 'Vence em 1 mês', severity: '1month' };
  if (end <= inThreeMonths) return { label: 'Vence em 3 meses', severity: '3months' };
  if (end <= inSixMonths) return { label: 'Vence em 6 meses', severity: '6months' };

  return null;
}

export const CONTRACT_EXPIRY_CLASS: Record<ContractExpirySeverity, string> = {
  expired: 'bg-red-100 text-red-800 border border-red-300',
  '1month': 'bg-red-50 text-red-700 border border-red-200',
  '3months': 'bg-amber-50 text-amber-800 border border-amber-200',
  '6months': 'bg-amber-50 text-amber-700 border border-amber-200',
};

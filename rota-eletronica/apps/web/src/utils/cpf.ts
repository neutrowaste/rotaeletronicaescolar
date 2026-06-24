export function normalizeCpfDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  const d = normalizeCpfDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== parseInt(d[9]!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]!, 10) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  return mod === parseInt(d[10]!, 10);
}

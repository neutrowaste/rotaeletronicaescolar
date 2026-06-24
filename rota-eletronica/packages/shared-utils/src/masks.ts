/**
 * Máscaras de formatação para CPF, telefone, placa, CEP
 */

/** CPF: 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Telefone: (DDD) 00000-0000 (celular) ou (DDD) 0000-0000 (fixo) */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

/** Placa: Mercosul AAA0A00 ou antiga AAA-0000 */
export function maskPlate(value: string): string {
  const upper = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
  if (upper.length <= 3) {
    return upper;
  }
  if (upper.match(/^[A-Z]{3}\d[A-Z]\d{2}$/)) {
    return upper.replace(/^([A-Z]{3})([0-9][A-Z])([0-9]{2})$/, '$1-$2$3');
  }
  return upper.replace(/^([A-Z]{3})([0-9]{4})$/, '$1-$2');
}

/** CEP: 00000-000 */
export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '');
}

/** Remove toda formatação, retorna só dígitos */
export function unmaskDigits(value: string): string {
  return value.replace(/\D/g, '');
}

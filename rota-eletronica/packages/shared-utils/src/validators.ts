/**
 * Validadores reutilizáveis (CPF, e-mail, etc.)
 */

/** Validação básica de CPF (dígitos verificadores) */
export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10], 10)) return false;

  return true;
}

/** Validação de e-mail */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Senha mínimo 8 caracteres */
export function validatePasswordMinLength(password: string, min = 8): boolean {
  return password.length >= min;
}

/** CEP brasileiro (8 dígitos) */
export function validateCep(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ''));
}

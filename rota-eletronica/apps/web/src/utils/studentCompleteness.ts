import type { Student } from '@rota-eletronica/shared-types';

export type StudentIncompleteField =
  | 'name'
  | 'registrationNumber'
  | 'birthDate'
  | 'grade'
  | 'schoolId'
  | 'municipalityId'
  | 'address'
  | 'boardingPoint'
  | 'alightingPoint'
  | 'photo'
  | 'responsibleName'
  | 'responsibleRelationship'
  | 'responsibleCpf'
  | 'responsiblePhone'
  | 'responsibleEmail';

const FIELD_MESSAGES: Record<StudentIncompleteField, string> = {
  name: 'Nome ausente',
  registrationNumber: 'Matrícula ausente',
  birthDate: 'Data de nascimento ausente',
  grade: 'Série ausente',
  schoolId: 'Escola não informada',
  municipalityId: 'Município não informado',
  address: 'Endereço incompleto',
  boardingPoint: 'Parada de embarque não informada',
  alightingPoint: 'Desembarque não informado',
  photo: 'Sem foto cadastrada',
  responsibleName: 'Responsável não informado',
  responsibleRelationship: 'Parentesco do responsável ausente',
  responsibleCpf: 'CPF do responsável ausente ou incompleto',
  responsiblePhone: 'Telefone do responsável ausente',
  responsibleEmail: 'E-mail do responsável ausente',
};

export const INCOMPLETE_TEXT_CLASS = 'text-amber-600';

export const INCOMPLETE_ALERT_ICON_CLASS = 'flex-shrink-0 text-amber-600';

export const INCOMPLETE_INPUT_HIGHLIGHT =
  'border-amber-400/60 ring-1 ring-amber-400/40 bg-amber-500/5 focus:ring-amber-400/50';

/** Mesmas cores do banner de cadastro incompleto. */
export const INCOMPLETE_SURFACE_CLASS = 'bg-amber-50 border-amber-200';

/** Destaque de card no detalhe (substitui fundo/borda padrão do card). */
export const INCOMPLETE_CARD_HIGHLIGHT = INCOMPLETE_SURFACE_CLASS;

export const INCOMPLETE_EMPTY_BOX_HIGHLIGHT = INCOMPLETE_SURFACE_CLASS;

export const INCOMPLETE_PHOTO_FRAME = 'border-amber-400 ring-2 ring-amber-400/30';

export function isDashOrBlank(v: string | undefined | null): boolean {
  const t = (v ?? '').trim();
  return t === '' || t === '-';
}

/** Foto apenas inicial gerada (sem upload real). */
export function isPlaceholderStudentPhoto(photo: string | undefined | null): boolean {
  const p = (photo ?? '').trim();
  if (!p) return true;
  return p.includes('ui-avatars.com');
}

export function getStudentIncompleteFields(student: Student): StudentIncompleteField[] {
  const fields: StudentIncompleteField[] = [];
  if (isDashOrBlank(student.name)) fields.push('name');
  if (isDashOrBlank(student.registrationNumber)) fields.push('registrationNumber');
  if (isDashOrBlank(student.birthDate)) fields.push('birthDate');
  if (isDashOrBlank(student.grade)) fields.push('grade');
  if (!student.schoolId?.trim()) fields.push('schoolId');
  if (!student.municipalityId?.trim()) fields.push('municipalityId');
  if (isDashOrBlank(student.address)) fields.push('address');
  if (!student.boardingPoint || isDashOrBlank(student.boardingPoint.address)) fields.push('boardingPoint');
  if (!student.alightingPoint || isDashOrBlank(student.alightingPoint.address)) fields.push('alightingPoint');
  const r = student.responsible;
  if (!r || isDashOrBlank(r.name)) fields.push('responsibleName');
  if (r && isDashOrBlank(r.relationship)) fields.push('responsibleRelationship');
  if (r) {
    const cpfDigits = (r.cpf ?? '').replace(/\D/g, '').length;
    if (cpfDigits < 11) fields.push('responsibleCpf');
    const phoneDigits = (r.phone ?? '').replace(/\D/g, '').length;
    if (isDashOrBlank(r.phone) || phoneDigits < 10) fields.push('responsiblePhone');
    const email = (r.email ?? '').trim();
    if (isDashOrBlank(r.email) || !email.includes('@')) fields.push('responsibleEmail');
  }
  if (isPlaceholderStudentPhoto(student.photo)) fields.push('photo');
  return fields;
}

export function getStudentIncompleteMessages(student: Student): string[] {
  return getStudentIncompleteFields(student).map((f) => FIELD_MESSAGES[f]);
}

export function getStudentIncompleteFieldSet(student: Student): Set<StudentIncompleteField> {
  return new Set(getStudentIncompleteFields(student));
}

export function incompleteInputClass(
  baseClass: string,
  field: StudentIncompleteField,
  incomplete: Set<StudentIncompleteField>
): string {
  return incomplete.has(field) ? `${baseClass} ${INCOMPLETE_INPUT_HIGHLIGHT}` : baseClass;
}

export function incompleteCardClass(
  baseClass: string,
  field: StudentIncompleteField,
  incomplete: Set<StudentIncompleteField>
): string {
  if (!incomplete.has(field)) return baseClass;
  return baseClass
    .replace(/\bbg-white\/5\b/, 'bg-amber-50')
    .replace(/\bborder-urban-petrol\/30\b/, 'border-amber-200');
}

export function incompleteSectionCardClass(
  baseClass: string,
  highlighted: boolean
): string {
  if (!highlighted) return baseClass;
  return baseClass
    .replace(/\bbg-white\/5\b/, 'bg-amber-50')
    .replace(/\bborder-urban-petrol\/30\b/, 'border-amber-200');
}

export function incompleteDetailValueClass(
  baseClass: string,
  field: StudentIncompleteField,
  incomplete: Set<StudentIncompleteField>
): string {
  return incomplete.has(field) ? `${baseClass} ${INCOMPLETE_TEXT_CLASS}` : baseClass;
}

export function incompleteListCellClass(
  field: StudentIncompleteField,
  incomplete: Set<StudentIncompleteField>
): string {
  return incomplete.has(field) ? INCOMPLETE_TEXT_CLASS : '';
}

export function isResponsibleSectionIncomplete(incomplete: Set<StudentIncompleteField>): boolean {
  return (
    incomplete.has('responsibleName') ||
    incomplete.has('responsibleRelationship') ||
    incomplete.has('responsibleCpf') ||
    incomplete.has('responsiblePhone') ||
    incomplete.has('responsibleEmail')
  );
}

export function displayValueOrDash(value: string | undefined | null): string {
  return isDashOrBlank(value) ? '—' : (value ?? '').trim();
}

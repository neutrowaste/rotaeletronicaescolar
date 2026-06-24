/**
 * Tipos compartilhados - UrbanData Rota Eletrônica Escolar
 * Usados por apps/web, apps/mobile-pais e apps/mobile-motorista
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Período de um contrato (usado no histórico) */
export interface ContractPeriod {
  contractStart: string; // YYYY-MM-DD
  contractEnd: string;   // YYYY-MM-DD
}

export interface Municipality {
  id: string;
  name: string;
  state: string;
  ibgeCode: string;
  /** Centro do município (lat/lng) para mapa e referência */
  coordinates?: Coordinates;
  responsible: string;
  /** Cargo/Função do responsável (contato) */
  responsibleRole: string;
  phone: string;
  email: string;
  contractStart: string; // YYYY-MM-DD
  contractEnd: string;   // YYYY-MM-DD
  /** Histórico de contratos vencidos (o vigente está em contractStart/contractEnd) */
  contractHistory?: ContractPeriod[];
  totalStudents: number;
  totalVehicles: number;
  totalRoutes: number;
  status: 'active' | 'inactive';
  /** Brasão do município (URL relativa ao site ou absoluta). */
  brasaoUrl?: string | null;
}

export interface School {
  id: string;
  name: string;
  address: string;
  municipalityId: string;
  coordinates: Coordinates;
  phone: string;
  principal: string;
  totalStudents: number;
  status: 'active' | 'inactive';
}

export interface Garage {
  id: string;
  name: string;
  address: string;
  municipalityId: string;
  coordinates: Coordinates;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  municipalityId: string;
  garageId: string; // Garagem de origem do veículo
  driverResponsible: string; // driverId
  renavam: string;
  chassis: string;
  lastInspectionDate: string; // YYYY-MM-DD
  status: 'active' | 'maintenance' | 'inactive';
  routesCount: number;
  /** Tipo de transporte: Escolar ou Saúde */
  transportType?: 'escolar' | 'saude' | 'nao_informado';
  /** Última posição reportada pelo app do motorista (ISO). */
  lastLocationAt?: string;
  lastLocation?: Coordinates;
}

/** Linha da grade de monitoramento (mapa / frota). */
export interface MonitoringVehicleRow {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  vehicleStatus: string;
  vehicleStatusLabel: string;
  lastLocationAt: string | null;
  lastLocation: Coordinates | null;
  routeName: string | null;
  routeId: string | null;
  driverName: string | null;
  scheduleStatus: string | null;
  scheduleStatusLabel: string | null;
  startTime: string | null;
  lastStopLabel: string;
  nextStopLabel: string;
}

export interface Driver {
  id: string;
  name: string;
  cpf: string;
  employeeId: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  licenseCategory: string; // ex: D, E
  licenseExpiry: string; // YYYY-MM-DD
  /** Municípios em que o motorista pode atuar (um ou mais) */
  municipalityIds: string[];
  status: 'active' | 'inactive';
}

export interface Responsible {
  name: string;
  relationship: string;
  cpf: string;
  phone: string;
  email: string;
}

/** Turno escolar (UI: Manhã, Tarde, Integral). */
export type ShiftPeriod = 'morning' | 'afternoon' | 'integral';
/** Valor possível no banco; `night` é legado (equivalente a Integral). */
export type ShiftStored = ShiftPeriod | 'night';

export const SHIFT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  integral: 'Integral',
  night: 'Integral',
};

export const SHIFT_SELECT_OPTIONS: { value: ShiftPeriod; label: string }[] = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'integral', label: 'Integral' },
];

/** Normaliza legado `night` → `integral` para formulários e novos salvamentos. */
export function normalizeShiftToPeriod(shift: string | undefined | null): ShiftPeriod {
  if (shift === 'night') return 'integral';
  if (shift === 'morning' || shift === 'afternoon' || shift === 'integral') return shift;
  return 'morning';
}

/** Rótulo para listagens e detalhes (inclui `night` legado). */
export function shiftLabel(shift: string | undefined | null): string {
  if (shift == null || shift === '') return '—';
  return SHIFT_LABELS[shift] ?? shift;
}

/** Filtro por turno: `integral` inclui registros legados `night`. */
export function matchesShiftFilter(rowShift: string, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'integral') return rowShift === 'integral' || rowShift === 'night';
  return rowShift === filter;
}

export interface Student {
  id: string;
  name: string;
  registrationNumber: string;
  birthDate: string; // YYYY-MM-DD
  grade: string;
  shift: ShiftStored;
  schoolId: string;
  municipalityId: string;
  address: string;
  boardingPoint: {
    address: string;
    coordinates: Coordinates;
    /** Geocodificação do endereço residencial do aluno (distinto das coordenadas da parada). */
    homeCoordinates?: Coordinates;
    distanceMeters?: number;
    cep?: string;
  };
  addressFields?: { cep?: string; street?: string; number?: string; neighborhood?: string };
  alightingPoint: { address: string; coordinates: Coordinates };
  responsible: Responsible;
  specialNeeds: boolean;
  specialNeedsDescription?: string;
  routeId: string | null;
  status: 'active' | 'inactive' | 'transferred';
  photo: string; // URL ui-avatars.com
}

export interface Stop {
  id: string;
  order: number;
  address: string;
  coordinates: Coordinates;
  studentsIds: string[];
  estimatedArrival: string; // HH:MM
}

export type RouteStatus = 'active' | 'inactive' | 'in_progress' | 'completed';

export interface Route {
  id: string;
  name: string;
  municipalityId: string;
  /** Opcional: veículo é definido na escala, não na rota. */
  vehicleId?: string | null;
  /** Opcional: motorista é definido na escala. */
  driverId?: string;
  schoolId: string;
  /** Garagem de origem do trajeto (roteirização). */
  garageId?: string;
  shift: ShiftStored;
  totalStudents: number;
  totalStops: number;
  estimatedKm: number;
  estimatedDuration: number; // minutes
  status: RouteStatus;
  scheduleId: string | null;
  stops: Stop[];
  polyline: string; // encoded
  origin: Coordinates;
  createdAt: string; // ISO
  lastUpdated: string; // ISO
  /** Data/hora da geração da rota otimizada (ISO) */
  generatedAt?: string;
  /** ID do usuário que criou a rota */
  createdBy?: string;
}

/** Origem do agendamento na UI: frequência (semana) ou data (avulso / período). */
export type ScheduleKind = 'data' | 'frequency';

export interface Schedule {
  id: string;
  name: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  date: string; // YYYY-MM-DD
  shift: ShiftStored;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  /** `frequency` = modo frequência; `data` = avulso ou recorrência em período (padrão). */
  scheduleKind?: ScheduleKind;
  /** Ordem da última parada concluída (app motorista). */
  lastPassedStopOrder?: number;
  incidents: Incident[];
}

export interface Incident {
  id: string;
  routeId: string;
  scheduleId: string;
  type: 'delay_traffic' | 'delay_other' | 'mechanical_failure' | 'accident' | 'road_block' | 'student_not_found' | 'student_issue' | 'other';
  description: string;
  estimatedDelay?: number; // minutes
  location: Coordinates;
  registeredAt: string; // ISO
  resolvedAt?: string; // ISO
  status: 'active' | 'resolved';
}

export interface StudentBoardingStatus {
  studentId: string;
  timestamp?: string; // ISO
  confirmedBy?: 'facial' | 'manual';
  confidence?: number; // 0-100
  capturedPhoto?: string;
}

export interface ParentUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  studentsIds: string[];
}

export type UsuarioPerfil = 'ADMIN' | 'GESTOR' | 'OPERADOR';
export type UsuarioSetor = 'SETOR_TRANSPORTE' | 'SETOR_MAPAS' | 'SETOR_EDUCACAO';
export type UsuarioStatus = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

/** Ações configuráveis por módulo (GESTOR / OPERADOR). */
export const ACAO_PERMISSAO_VALUES = ['visualizar', 'criar', 'editar', 'excluir'] as const;
export type AcaoPermissao = (typeof ACAO_PERMISSAO_VALUES)[number];

/** Módulos do painel alinhados à sidebar e rotas. */
export const MODULO_PERMISSAO_VALUES = [
  'dashboard',
  'usuarios',
  'municipios',
  'escolas',
  'garagens',
  'veiculos',
  'motoristas',
  'roteirizacao',
  'escalas',
  'alunos',
  'mapa',
  'permissoes',
] as const;
export type ModuloPermissao = (typeof MODULO_PERMISSAO_VALUES)[number];

/** Matriz de permissões (API / banco JSON). `null` no usuário = acesso total (legado). */
export type PermissoesUsuario = Partial<
  Record<ModuloPermissao, Partial<Record<AcaoPermissao, boolean>>>
>;

export const MODULO_PERMISSAO_LABELS: Record<ModuloPermissao, string> = {
  dashboard: 'Dashboard',
  usuarios: 'Usuários',
  municipios: 'Municípios',
  escolas: 'Escolas',
  garagens: 'Garagem',
  veiculos: 'Veículos',
  motoristas: 'Motoristas',
  roteirizacao: 'Roteirização',
  escalas: 'Escalas',
  alunos: 'Alunos',
  mapa: 'Monitoramento',
  permissoes: 'Permissões',
};

export const ACAO_PERMISSAO_LABELS: Record<AcaoPermissao, string> = {
  visualizar: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
};

/** Usuário do painel web (cadastro em `usuarios`). */
export interface WebUser {
  id: string;
  name: string;
  email: string;
  login: string;
  /** Igual a `UsuarioPerfil` na API. Legado em storage: `admin` (= antigo JWT de gestor). */
  role: UsuarioPerfil | 'admin';
  /** Ausente para alguns administradores (vínculo opcional no cadastro). */
  municipioId?: string | null;
  /** UF de atuação (mesmo valor que `state` dos municípios no cadastro). */
  ufAtuacao?: string | null;
  setorUnidade?: UsuarioSetor | null;
  telefone?: string;
  status?: UsuarioStatus;
  deveTrocarSenha?: boolean;
  ultimoAcessoEm?: string | null;
  /** Derivado de `municipioId` para telas que filtram por lista de municípios */
  municipalityIds?: string[];
  /** CPF (apenas dígitos ou já normalizado no cadastro). */
  cpf?: string;
  /** Cidades de atuação (resposta de `/auth/me` e login). */
  municipios?: Array<{ id: string; name: string; state: string }>;
  /** Foto do perfil (data URL); ausente ou vazio = exibir iniciais */
  photo?: string | null;
  /** GESTOR/OPERADOR: matriz de módulos/ações. `null` = todas as ações (comportamento legado). */
  permissoes?: PermissoesUsuario | null;
}

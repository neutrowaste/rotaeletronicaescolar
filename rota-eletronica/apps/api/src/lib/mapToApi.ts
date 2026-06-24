/**
 * Mapeia modelos Prisma (snake_case no DB) para formato da API (camelCase) usado pelo frontend.
 */
import type {
  Municipality,
  School,
  Garage,
  Vehicle,
  Driver,
  Student,
  Route,
  Schedule,
  Incident,
  Usuario,
} from '../../node_modules/.prisma/api-client/index.js';
import { effectivePermissoesForSession, permissoesFromDb } from './permissoesUsuario.js';
import { decryptAtRest } from './atRestCrypto.js';
import { parseDriverMunicipalityIds } from './municipalityIds.js';

function profilePhotoFromDb(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  return decryptAtRest(raw) || null;
}

type PrismaMunicipality = Municipality & { coordinates?: unknown; contractHistory?: unknown };
type PrismaSchool = School & { coordinates?: unknown };
type PrismaGarage = Garage & { coordinates?: unknown };
type PrismaVehicle = Vehicle;
type PrismaDriver = Driver & { municipalityIds?: unknown };
type PrismaStudent = Student & { boardingPoint?: unknown; alightingPoint?: unknown; responsible?: unknown };
type PrismaRoute = Route & { stops?: unknown; origin?: unknown };
type PrismaSchedule = Schedule;
type PrismaIncident = Incident & { location?: unknown };
type UsuarioMunicipioRow = {
  municipioId: string;
  municipality?: { id: string; name: string; state: string };
};
type PrismaUsuario = Usuario & { usuarioMunicipios?: UsuarioMunicipioRow[] };

function municipioIdsFromUsuario(m: PrismaUsuario): string[] {
  return m.usuarioMunicipios?.map((x) => x.municipioId) ?? [];
}

function municipiosFromUsuarioRows(m: PrismaUsuario): Array<{ id: string; name: string; state: string }> {
  return (
    m.usuarioMunicipios?.map((um) => ({
      id: um.municipality?.id ?? um.municipioId,
      name: um.municipality?.name ?? '',
      state: um.municipality?.state ?? '',
    })) ?? []
  );
}

function toMunicipality(m: PrismaMunicipality) {
  return {
    id: m.id,
    name: m.name,
    state: m.state,
    ibgeCode: m.ibgeCode,
    coordinates: m.coordinates as { lat: number; lng: number } | undefined,
    responsible: m.responsible,
    responsibleRole: (m as any).responsibleRole ?? '-',
    phone: m.phone,
    email: m.email,
    contractStart: m.contractStart,
    contractEnd: m.contractEnd,
    contractHistory: m.contractHistory as { contractStart: string; contractEnd: string }[] | undefined,
    totalStudents: m.totalStudents,
    totalVehicles: m.totalVehicles,
    totalRoutes: m.totalRoutes,
    status: m.status as 'active' | 'inactive',
    brasaoUrl: m.brasaoUrl ?? null,
  };
}

function toSchool(m: PrismaSchool) {
  return {
    id: m.id,
    name: m.name,
    address: m.address,
    municipalityId: m.municipalityId,
    coordinates: m.coordinates as { lat: number; lng: number },
    phone: m.phone,
    principal: m.principal,
    totalStudents: m.totalStudents,
    status: m.status as 'active' | 'inactive',
  };
}

function toGarage(m: PrismaGarage) {
  return {
    id: m.id,
    name: m.name,
    address: m.address,
    municipalityId: m.municipalityId,
    coordinates: m.coordinates as { lat: number; lng: number },
  };
}

function toVehicle(m: PrismaVehicle) {
  const loc = (m as { lastLocation?: unknown; lastLocationAt?: Date | null }).lastLocation;
  const lastAt = (m as { lastLocationAt?: Date | null }).lastLocationAt;
  const coords =
    loc != null && typeof loc === 'object' && loc !== null && 'lat' in loc && 'lng' in loc
      ? { lat: Number((loc as { lat: unknown }).lat), lng: Number((loc as { lng: unknown }).lng) }
      : undefined;
  return {
    id: m.id,
    plate: m.plate,
    brand: m.brand,
    model: m.model,
    year: m.year,
    color: m.color,
    capacity: m.capacity,
    municipalityId: m.municipalityId,
    garageId: m.garageId,
    transportType: (m as any).transportType ?? 'nao_informado',
    driverResponsible: m.driverResponsible ?? '',
    renavam: m.renavam,
    chassis: m.chassis,
    lastInspectionDate: m.lastInspectionDate,
    status: m.status as 'active' | 'maintenance' | 'inactive',
    routesCount: m.routesCount,
    ...(lastAt ? { lastLocationAt: lastAt.toISOString() } : {}),
    ...(coords ? { lastLocation: coords } : {}),
  };
}

function toDriver(m: PrismaDriver) {
  return {
    id: m.id,
    name: m.name,
    cpf: m.cpf,
    employeeId: m.employeeId,
    address: m.address,
    phone: m.phone,
    email: m.email,
    licenseNumber: m.licenseNumber,
    licenseCategory: m.licenseCategory,
    licenseExpiry: m.licenseExpiry,
    municipalityIds: parseDriverMunicipalityIds(m.municipalityIds),
    status: m.status as 'active' | 'inactive',
  };
}

function toStudent(m: PrismaStudent) {
  return {
    id: m.id,
    name: m.name,
    registrationNumber: m.registrationNumber,
    birthDate: m.birthDate,
    grade: m.grade,
    shift: m.shift as 'morning' | 'afternoon' | 'integral' | 'night',
    schoolId: m.schoolId,
    municipalityId: m.municipalityId,
    address: m.address,
    boardingPoint: m.boardingPoint as { address: string; coordinates: { lat: number; lng: number } },
    alightingPoint: m.alightingPoint as { address: string; coordinates: { lat: number; lng: number } },
    responsible: m.responsible as { name: string; relationship: string; cpf: string; phone: string; email: string },
    specialNeeds: m.specialNeeds,
    specialNeedsDescription: m.specialNeedsDesc ?? undefined,
    routeId: m.routeId,
    status: m.status as 'active' | 'inactive' | 'transferred',
    photo: m.photo,
  };
}

function toRoute(m: PrismaRoute) {
  return {
    id: m.id,
    name: m.name,
    municipalityId: m.municipalityId,
    vehicleId: m.vehicleId ?? null,
    driverId: m.driverId ?? '',
    schoolId: m.schoolId,
    garageId: m.garageId ?? undefined,
    shift: m.shift as 'morning' | 'afternoon' | 'integral' | 'night',
    totalStudents: m.totalStudents,
    totalStops: m.totalStops,
    estimatedKm: m.estimatedKm,
    estimatedDuration: m.estimatedDuration,
    status: m.status as 'active' | 'inactive' | 'in_progress' | 'completed',
    scheduleId: m.scheduleId,
    stops: (m.stops as unknown[]) ?? [],
    polyline: m.polyline,
    origin: m.origin as { lat: number; lng: number },
    createdAt: m.createdAt.toISOString(),
    lastUpdated: m.lastUpdated.toISOString(),
    generatedAt: m.generatedAt?.toISOString(),
    createdBy: m.createdBy ?? undefined,
  };
}

function toSchedule(m: PrismaSchedule & { incidents?: PrismaIncident[] }) {
  const incidents = (m.incidents ?? []).map(toIncident);
  const sk = (m as { scheduleKind?: string }).scheduleKind;
  return {
    id: m.id,
    name: m.name,
    routeId: m.routeId,
    vehicleId: m.vehicleId,
    driverId: m.driverId,
    date: m.date,
    shift: m.shift as 'morning' | 'afternoon' | 'integral' | 'night',
    status: m.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
    startTime: m.startTime,
    endTime: m.endTime,
    scheduleKind: sk === 'frequency' ? 'frequency' : 'data',
    lastPassedStopOrder: (m as { lastPassedStopOrder?: number }).lastPassedStopOrder ?? 0,
    incidents,
  };
}

function toIncident(m: PrismaIncident) {
  return {
    id: m.id,
    routeId: m.routeId,
    scheduleId: m.scheduleId,
    type: m.type as 'delay_traffic' | 'delay_other' | 'mechanical_failure' | 'accident' | 'road_block' | 'student_not_found' | 'student_issue' | 'other',
    description: m.description,
    estimatedDelay: m.estimatedDelay ?? undefined,
    location: m.location as { lat: number; lng: number },
    registeredAt: m.registeredAt.toISOString(),
    resolvedAt: m.resolvedAt?.toISOString(),
    status: m.status as 'active' | 'resolved',
  };
}

/** Resposta de sessão (login) — sem senha. `permissoesPerfil` vem da tabela `perfil_permissoes` (GESTOR/OPERADOR). */
function toUsuarioSession(
  m: PrismaUsuario,
  permissoesPerfil: unknown | null
): {
  id: string;
  name: string;
  email: string;
  login: string;
  role: string;
  cpf: string;
  municipioId: string | null;
  municipioIds: string[];
  municipios: Array<{ id: string; name: string; state: string }>;
  ufAtuacao: string | null;
  setorUnidade: string | null;
  telefone: string;
  status: string;
  deveTrocarSenha: boolean;
  ultimoAcessoEm: string | null;
  photo: string | null;
  permissoes: ReturnType<typeof permissoesFromDb>;
} {
  const mids = municipioIdsFromUsuario(m);
  return {
    id: m.id,
    name: m.nomeCompleto,
    email: m.email,
    login: m.login,
    role: m.perfil,
    cpf: m.cpf,
    municipioId: mids[0] ?? null,
    municipioIds: mids,
    municipios: municipiosFromUsuarioRows(m),
    ufAtuacao: m.ufAtuacao ?? null,
    setorUnidade: m.setorUnidade ?? null,
    telefone: m.telefone,
    status: m.status,
    deveTrocarSenha: m.deveTrocarSenha,
    ultimoAcessoEm: m.ultimoAcessoEm?.toISOString() ?? null,
    photo: profilePhotoFromDb(m.fotoPerfil),
    permissoes: permissoesFromDb(
      effectivePermissoesForSession(permissoesPerfil, m.setorUnidade ?? null, m.perfil)
    ),
  };
}

/** Mesmo contrato que `toUsuarioSession` (payload já resolvido). */
function toUsuarioSessionPlain(input: {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  login: string;
  perfil: string;
  municipioIds: string[];
  municipios?: Array<{ id: string; name: string; state: string }>;
  ufAtuacao: string | null;
  setorUnidade: string | null;
  telefone: string;
  status: string;
  deveTrocarSenha: boolean;
  ultimoAcessoEm: Date | null;
  fotoPerfil?: string | null;
  permissoes?: unknown;
}) {
  const mids = input.municipioIds ?? [];
  const municipios = input.municipios ?? [];
  return {
    id: input.id,
    name: input.nomeCompleto,
    email: input.email,
    login: input.login,
    role: input.perfil,
    cpf: input.cpf,
    municipioId: mids[0] ?? null,
    municipioIds: mids,
    municipios,
    ufAtuacao: input.ufAtuacao ?? null,
    setorUnidade: input.setorUnidade ?? null,
    telefone: input.telefone,
    status: input.status,
    deveTrocarSenha: input.deveTrocarSenha,
    ultimoAcessoEm: input.ultimoAcessoEm?.toISOString() ?? null,
    photo: profilePhotoFromDb(input.fotoPerfil),
    permissoes: permissoesFromDb(
      effectivePermissoesForSession(input.permissoes, input.setorUnidade ?? null, input.perfil)
    ),
  };
}

/** Detalhe / listagem — permissões são por perfil (não retornadas aqui). */
function toUsuarioPublic(m: PrismaUsuario): {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string;
  login: string;
  perfil: string;
  status: string;
  ufAtuacao: string | null;
  municipioIds: string[];
  setorUnidade: string | null;
  deveTrocarSenha: boolean;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  criadoPorUsuarioId: string | null;
  municipios: Array<{ id: string; name: string; state: string }>;
} {
  const municipios =
    m.usuarioMunicipios?.map((um) => ({
      id: um.municipality?.id ?? um.municipioId,
      name: um.municipality?.name ?? '',
      state: um.municipality?.state ?? '',
    })) ?? [];
  return {
    id: m.id,
    nomeCompleto: m.nomeCompleto,
    cpf: m.cpf,
    email: m.email,
    telefone: m.telefone,
    login: m.login,
    perfil: m.perfil,
    status: m.status,
    ufAtuacao: m.ufAtuacao ?? null,
    municipioIds: municipioIdsFromUsuario(m),
    setorUnidade: m.setorUnidade ?? null,
    deveTrocarSenha: m.deveTrocarSenha,
    ultimoAcessoEm: m.ultimoAcessoEm?.toISOString() ?? null,
    criadoEm: m.criadoEm.toISOString(),
    atualizadoEm: m.atualizadoEm.toISOString(),
    criadoPorUsuarioId: m.criadoPorUsuarioId ?? null,
    municipios,
  };
}

export const mapToApi = {
  toMunicipality,
  toSchool,
  toGarage,
  toVehicle,
  toDriver,
  toStudent,
  toRoute,
  toSchedule,
  toIncident,
  toUsuarioSession,
  toUsuarioSessionPlain,
  toUsuarioPublic,
};

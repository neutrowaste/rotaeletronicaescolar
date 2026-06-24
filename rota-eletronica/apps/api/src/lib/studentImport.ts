import unzipper from 'unzipper';
import type { Route, ShiftPeriod } from '@rota-eletronica/shared-types';
import { normalizeShiftToPeriod } from '@rota-eletronica/shared-types';
import { prisma } from './prisma.js';
import { mapToApi } from './mapToApi.js';
import { fetchByCep } from './cepService.js';
import { geocodeAddress } from './geocodeService.js';
import {
  BOARDING_STOP_OPTIONS_LIMIT,
  getStopsInMunicipalitySorted,
} from './stopsService.js';
import {
  SEM_FOTO,
  STUDENT_EXCEL_FILENAME,
  buildPhotoFileName,
  buildStudentAddress,
  cellValue,
  isCellEmpty,
  isSameStudentAddress,
  parseOptionalImportBirthDate,
  parseOptionalImportStatus,
  parseShiftFromLabel,
  parseSpecialNeeds,
  normalizeCepDigits,
  type StudentExcelRecord,
} from './studentCsv.js';
import { parseExcelBuffer } from './studentExcel.js';

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export type StudentImportRegistroStatus = 'Criado' | 'Atualizado' | 'Erro';

export type StudentImportAlertasLabel = 'Sim' | '-';

export type StudentImportRegistro = {
  linha: number;
  nomeAluno?: string;
  matricula?: string;
  status: StudentImportRegistroStatus;
  alertas: StudentImportAlertasLabel;
  observacao: string;
};

export type StudentImportReport = {
  totalEnviados: number;
  totalImportados: number;
  totalCriados: number;
  totalAtualizados: number;
  totalImportadosAlertas: number;
  totalNaoImportados: number;
  registros: StudentImportRegistro[];
};

function rowIdentity(rec: StudentExcelRecord): { nomeAluno?: string; matricula?: string } {
  const nome = cellValue(rec['Nome completo']);
  const matricula = cellValue(rec['Matrícula']);
  return {
    nomeAluno: nome || undefined,
    matricula: matricula || undefined,
  };
}

function successObservation(status: 'Criado' | 'Atualizado', alerts: string[]): string {
  const base =
    status === 'Criado'
      ? 'Cadastro criado com sucesso.'
      : 'Cadastro existente atualizado com sucesso.';
  if (!alerts.length) return base;
  return `${base} ${alerts.join(' ')}`;
}

type MunicipalityRow = { id: string; name: string; state: string; ibgeCode: string };
type SchoolRow = {
  id: string;
  name: string;
  municipalityId: string;
  address: string;
  coordinates: { lat: number; lng: number };
};

type ImportContext = {
  allowedMunicipalityIds: string[] | null;
  upsert: boolean;
};

function normalizeNameKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function isAlunosExcelEntry(path: string): boolean {
  const baseName = path.split('/').pop() ?? path;
  return baseName === STUDENT_EXCEL_FILENAME || baseName.toLowerCase() === 'alunos.xlsx';
}

async function extractPackage(
  buffer: Buffer,
  _filename: string
): Promise<{ excelBuffer: Buffer; photos: Map<string, Buffer> }> {
  if (!isZipBuffer(buffer)) {
    throw new Error(
      `Arquivo inválido: envie um .zip contendo ${STUDENT_EXCEL_FILENAME} e a pasta fotos/.`
    );
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    throw new Error('Arquivo muito grande. Limite: 50 MB.');
  }
  const directory = await unzipper.Open.buffer(buffer);
  let excelBuffer: Buffer | null = null;
  const photos = new Map<string, Buffer>();
  for (const entry of directory.files) {
    if (entry.type === 'Directory') continue;
    const path = entry.path.replace(/\\/g, '/');
    if (isAlunosExcelEntry(path)) {
      excelBuffer = await entry.buffer();
      continue;
    }
    const fotoMatch = path.match(/(?:^|\/)fotos\/([^/]+\.(?:jpe?g|png|webp))$/i);
    if (fotoMatch) {
      const name = fotoMatch[1];
      const buf = await entry.buffer();
      if (buf.length > 0) photos.set(name, buf);
      const base = `fotos/${name}`;
      if (!photos.has(base)) photos.set(base, buf);
    }
  }
  if (!excelBuffer?.length) {
    throw new Error(
      `ZIP inválido: não encontrado ${STUDENT_EXCEL_FILENAME}. O pacote deve conter o arquivo alunos (Excel) e a pasta fotos/.`
    );
  }
  return { excelBuffer, photos };
}

function photoBufferToDataUrl(buf: Buffer, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function defaultAvatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

function resolvePhoto(
  rec: StudentExcelRecord,
  photos: Map<string, Buffer>
): { photo: string; alerts: string[] } {
  const alerts: string[] = [];
  const fileCell = cellValue(rec['Nome do arquivo da foto']);
  if (!fileCell || fileCell.toUpperCase() === SEM_FOTO) {
    alerts.push('Foto não informada.');
    return { photo: defaultAvatarUrl(cellValue(rec['Nome completo']) || 'Aluno'), alerts };
  }
  const baseName = fileCell.replace(/^fotos\//i, '');
  const buf =
    photos.get(baseName) ??
    photos.get(fileCell) ??
    photos.get(`fotos/${baseName}`);
  if (buf?.length) return { photo: photoBufferToDataUrl(buf, baseName), alerts };
  const expected = buildPhotoFileName(
    cellValue(rec['Matrícula']),
    cellValue(rec['Nome completo'])
  );
  const alt = photos.get(expected) ?? photos.get(`fotos/${expected}`);
  if (alt?.length) return { photo: photoBufferToDataUrl(alt, expected), alerts };
  alerts.push('Foto não encontrada no pacote; utilizado avatar padrão.');
  return { photo: defaultAvatarUrl(cellValue(rec['Nome completo']) || 'Aluno'), alerts };
}

function findMunicipality(
  list: MunicipalityRow[],
  rec: StudentExcelRecord
): MunicipalityRow | null {
  const ibge = cellValue(rec['Código IBGE']);
  const name = cellValue(rec['Município']);
  const uf = cellValue(rec['Estado (UF)']);
  if (ibge) {
    const byIbge = list.find((m) => m.ibgeCode === ibge);
    if (byIbge) return byIbge;
  }
  if (name && uf) {
    const key = `${normalizeNameKey(name)}|${uf.toUpperCase()}`;
    return (
      list.find((m) => `${normalizeNameKey(m.name)}|${m.state.toUpperCase()}` === key) ??
      null
    );
  }
  return null;
}

function findSchool(list: SchoolRow[], municipalityId: string, schoolName: string): SchoolRow | null {
  const key = normalizeNameKey(schoolName);
  return (
    list.find(
      (s) => s.municipalityId === municipalityId && normalizeNameKey(s.name) === key
    ) ?? null
  );
}

type ExistingStudentTrajectory = {
  address: string;
  boardingPoint: unknown;
  alightingPoint: unknown;
  routeId: string | null;
};

async function buildStudentPayload(
  rec: StudentExcelRecord,
  ctx: {
    municipalities: MunicipalityRow[];
    schools: SchoolRow[];
    routes: Route[];
    photos: Map<string, Buffer>;
    existing?: ExistingStudentTrajectory | null;
  }
): Promise<{ data: Record<string, unknown>; alerts: string[] } | { error: string }> {
  const name = cellValue(rec['Nome completo']);
  const registrationNumber = cellValue(rec['Matrícula']);
  const respName = cellValue(rec['Nome do responsável']);

  if (!name) return { error: 'Nome completo é obrigatório.' };
  if (!registrationNumber) return { error: 'Matrícula é obrigatória.' };
  if (!respName) return { error: 'Nome do responsável é obrigatório.' };

  const cepDigits = normalizeCepDigits(rec['CEP']);
  const street = cellValue(rec['Rua']);
  const neighborhood = cellValue(rec['Bairro']);
  const number = cellValue(rec['Número']);

  if (cepDigits.length !== 8) {
    return { error: 'CEP é obrigatório na importação (8 dígitos).' };
  }
  if (!street) return { error: 'Rua é obrigatória na importação.' };
  if (!neighborhood) return { error: 'Bairro é obrigatório na importação.' };
  if (!number) return { error: 'Número é obrigatório na importação.' };

  const schoolName = cellValue(rec['Escola']);
  if (!schoolName) return { error: 'Escola é obrigatória.' };

  const grade = cellValue(rec['Série']);
  if (!grade) return { error: 'Série é obrigatória na importação.' };

  if (isCellEmpty(rec['Turno'])) return { error: 'Turno é obrigatório na importação.' };

  const phoneRaw = cellValue(rec['Telefone']);
  if (!phoneRaw || phoneRaw.replace(/\D/g, '').length < 10) {
    return { error: 'Telefone é obrigatório na importação.' };
  }

  const emailRaw = cellValue(rec['E-mail']);
  if (emailRaw && !emailRaw.includes('@')) {
    return { error: 'E-mail inválido. Informe um endereço com @ ou deixe "-" / em branco.' };
  }
  const email = emailRaw.includes('@') ? emailRaw : '-';

  const municipality = findMunicipality(ctx.municipalities, rec);
  if (!municipality) {
    return { error: 'Município não encontrado (informe Código IBGE ou Município + UF válidos).' };
  }

  const school = findSchool(ctx.schools, municipality.id, schoolName);
  if (!school) {
    return { error: `Escola "${schoolName}" não encontrada neste município.` };
  }

  const viaCep = await fetchByCep(cepDigits);
  if (!viaCep) {
    return { error: 'CEP inválido ou não encontrado na base dos Correios.' };
  }

  const shift = parseShiftFromLabel(rec['Turno'] ?? '') as ShiftPeriod;
  const shiftPeriod = normalizeShiftToPeriod(shift);

  const fullAddress = buildStudentAddress({
    street,
    number,
    neighborhood,
    municipalityName: municipality.name,
    state: municipality.state,
    cep: cepDigits,
  });

  const preserveTrajectory =
    ctx.existing != null && isSameStudentAddress(ctx.existing.address, fullAddress);

  let boardingPoint: Record<string, unknown>;
  let alightingPoint: Record<string, unknown>;
  let routeId: string | null;

  if (preserveTrajectory && ctx.existing) {
    boardingPoint = { ...(ctx.existing.boardingPoint as Record<string, unknown>) };
    alightingPoint = { ...(ctx.existing.alightingPoint as Record<string, unknown>) };
    routeId = ctx.existing.routeId;
    if (!boardingPoint.cep) boardingPoint.cep = cepDigits;
  } else {
    const geo = await geocodeAddress(
      [street, number, neighborhood, municipality.name, municipality.state, 'Brasil']
        .filter(Boolean)
        .join(', ')
    );
    if (!geo) {
      return { error: 'Não foi possível geocodificar o endereço (rua, número, bairro, município).' };
    }

    const schoolCoords = school.coordinates;
    const { stopsForBoarding } = getStopsInMunicipalitySorted(
      ctx.routes,
      municipality.id,
      geo,
      schoolCoords,
      BOARDING_STOP_OPTIONS_LIMIT,
      school.id,
      shiftPeriod
    );

    if (stopsForBoarding.length === 0) {
      return {
        error:
          'Nenhuma parada de ônibus encontrada para esta escola, turno e município. Cadastre rotas com paradas antes de importar.',
      };
    }

    const homeStop = stopsForBoarding[0];
    boardingPoint = {
      address: homeStop.address,
      coordinates: homeStop.coordinates,
      homeCoordinates: { lat: geo.lat, lng: geo.lng },
      distanceMeters: homeStop.distanceMeters,
      cep: cepDigits,
    };
    alightingPoint = {
      address: school.address || '-',
      coordinates: { ...schoolCoords },
    };
    routeId = homeStop.routeId ?? null;
  }

  const cpfRaw = cellValue(rec['CPF']);
  const cpfDigits = cpfRaw.replace(/\D/g, '');
  const cpfValid = cpfDigits.length >= 11;

  const birthParsed = parseOptionalImportBirthDate(rec['Data de nascimento'] ?? '');
  if (birthParsed.invalid) {
    return { error: 'Data de nascimento inválida. Use dd/MM/aaaa ou informe "-".' };
  }

  const statusParsed = parseOptionalImportStatus(rec['Status'] ?? '');
  if (statusParsed.invalid) {
    return { error: 'Status inválido. Use Ativo, Inativo, Transferido ou informe "-".' };
  }

  const relationshipRaw = cellValue(rec['Parentesco']);

  const specialNeeds = parseSpecialNeeds(rec['Necessidades especiais'] ?? '');
  const specialNeedsDesc = cellValue(rec['Descrição necessidades especiais']);

  const { photo, alerts: photoAlerts } = resolvePhoto(rec, ctx.photos);
  const alerts = [...photoAlerts];
  if (email === '-') alerts.push('E-mail não informado.');
  if (!cpfValid) alerts.push('CPF do responsável não informado ou inválido.');
  if (birthParsed.missing) alerts.push('Data de nascimento não informada.');
  if (statusParsed.missing) alerts.push('Status não informado.');
  if (!relationshipRaw) alerts.push('Parentesco do responsável não informado.');

  return {
    alerts,
    data: {
      name,
      registrationNumber,
      birthDate: birthParsed.value,
      grade,
      shift: shiftPeriod,
      schoolId: school.id,
      municipalityId: municipality.id,
      address: fullAddress,
      boardingPoint,
      alightingPoint,
      responsible: {
        name: respName,
        relationship: relationshipRaw || '-',
        cpf: cpfValid ? cpfRaw : '-',
        phone: phoneRaw,
        email,
      },
      specialNeeds,
      specialNeedsDescription: specialNeeds && specialNeedsDesc ? specialNeedsDesc : undefined,
      routeId,
      status: statusParsed.value,
      photo,
    },
  };
}

function toDb(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    registrationNumber: body.registrationNumber as string,
    birthDate: body.birthDate as string,
    grade: body.grade as string,
    shift: body.shift as string,
    schoolId: body.schoolId as string,
    municipalityId: body.municipalityId as string,
    address: body.address as string,
    boardingPoint: body.boardingPoint as object,
    alightingPoint: body.alightingPoint as object,
    responsible: body.responsible as object,
    specialNeeds: Boolean(body.specialNeeds),
    specialNeedsDesc: (body.specialNeedsDescription as string) ?? null,
    routeId: (body.routeId as string) || null,
    status: body.status as string,
    photo: (body.photo as string) || '',
  };
}

export async function runStudentImport(
  buffer: Buffer,
  filename: string,
  ctx: ImportContext
): Promise<StudentImportReport> {
  const { excelBuffer, photos } = await extractPackage(buffer, filename);
  const { records } = await parseExcelBuffer(excelBuffer);

  const munWhere =
    ctx.allowedMunicipalityIds === null
      ? {}
      : { id: { in: ctx.allowedMunicipalityIds } };

  const [municipalities, schools, routeRows] = await Promise.all([
    prisma.municipality.findMany({
      where: munWhere,
      select: { id: true, name: true, state: true, ibgeCode: true },
    }),
    prisma.school.findMany({
      where:
        ctx.allowedMunicipalityIds === null
          ? {}
          : { municipalityId: { in: ctx.allowedMunicipalityIds } },
      select: { id: true, name: true, municipalityId: true, address: true, coordinates: true },
    }),
    prisma.route.findMany({
      where:
        ctx.allowedMunicipalityIds === null
          ? {}
          : { municipalityId: { in: ctx.allowedMunicipalityIds } },
    }),
  ]);

  const schoolList: SchoolRow[] = schools.map((s) => ({
    id: s.id,
    name: s.name,
    municipalityId: s.municipalityId,
    address: s.address,
    coordinates: s.coordinates as { lat: number; lng: number },
  }));

  const routes: Route[] = routeRows.map((r) => mapToApi.toRoute(r) as Route);

  let totalCriados = 0;
  let totalAtualizados = 0;
  let totalNaoImportados = 0;
  let totalImportadosAlertas = 0;
  const registros: StudentImportRegistro[] = [];

  for (let i = 0; i < records.length; i++) {
    const line = i + 2;
    const rec = records[i];
    const identity = rowIdentity(rec);

    const pushErro = (observacao: string) => {
      totalNaoImportados += 1;
      registros.push({
        linha: line,
        ...identity,
        status: 'Erro',
        alertas: '-',
        observacao,
      });
    };

    try {
      let existingForImport: ExistingStudentTrajectory | null = null;
      if (ctx.upsert) {
        const municipality = findMunicipality(municipalities, rec);
        const registrationNumber = cellValue(rec['Matrícula']);
        if (municipality && registrationNumber) {
          existingForImport = await prisma.student.findFirst({
            where: {
              registrationNumber,
              municipalityId: municipality.id,
            },
            select: {
              address: true,
              boardingPoint: true,
              alightingPoint: true,
              routeId: true,
            },
          });
        }
      }

      const built = await buildStudentPayload(rec, {
        municipalities,
        schools: schoolList,
        routes,
        photos,
        existing: existingForImport,
      });

      if ('error' in built) {
        pushErro(built.error);
        continue;
      }

      const data = toDb(built.data);
      const alerts = built.alerts;

      if (ctx.allowedMunicipalityIds !== null && !ctx.allowedMunicipalityIds.includes(data.municipalityId)) {
        pushErro('Sem permissão para cadastrar alunos neste município.');
        continue;
      }

      const existing = await prisma.student.findFirst({
        where: {
          registrationNumber: data.registrationNumber,
          municipalityId: data.municipalityId,
        },
      });

      if (existing) {
        if (!ctx.upsert) {
          pushErro(
            `Matrícula já cadastrada (${existing.name}). Ative "Atualizar existentes" para sobrescrever.`
          );
          continue;
        }
        await prisma.student.update({ where: { id: existing.id }, data });
        totalAtualizados += 1;
        if (alerts.length) totalImportadosAlertas += 1;
        registros.push({
          linha: line,
          nomeAluno: data.name,
          matricula: data.registrationNumber,
          status: 'Atualizado',
          alertas: alerts.length > 0 ? 'Sim' : '-',
          observacao: successObservation('Atualizado', alerts),
        });
      } else {
        await prisma.student.create({ data });
        totalCriados += 1;
        if (alerts.length) totalImportadosAlertas += 1;
        registros.push({
          linha: line,
          nomeAluno: data.name,
          matricula: data.registrationNumber,
          status: 'Criado',
          alertas: alerts.length > 0 ? 'Sim' : '-',
          observacao: successObservation('Criado', alerts),
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error && /prisma|database|unique|constraint/i.test(e.message)
          ? 'Erro ao salvar no banco de dados.'
          : e instanceof Error
            ? e.message
            : 'Erro ao processar linha.';
      pushErro(msg);
    }
  }

  const totalImportados = totalCriados + totalAtualizados;

  if (registros.length !== records.length) {
    throw new Error('Erro interno ao montar relatório da importação.');
  }

  return {
    totalEnviados: records.length,
    totalImportados,
    totalCriados,
    totalAtualizados,
    totalImportadosAlertas,
    totalNaoImportados,
    registros,
  };
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isDashOrBlank(v) {
  const t = (v ?? '').trim();
  return t === '' || t === '-';
}

function isPlaceholderPhoto(photo) {
  const p = (photo ?? '').trim();
  return !p || p.includes('ui-avatars.com');
}

function auditStudent(row) {
  const boarding = row.boarding_point;
  const alighting = row.alighting_point;
  const responsible = row.responsible;
  const issues = [];

  if (isDashOrBlank(row.name)) issues.push('name');
  if (isDashOrBlank(row.registration_number)) issues.push('registrationNumber');
  if (isDashOrBlank(row.birth_date)) issues.push('birthDate');
  if (isDashOrBlank(row.grade)) issues.push('grade');
  if (!row.school_id) issues.push('schoolId');
  if (!row.municipality_id) issues.push('municipalityId');
  if (isDashOrBlank(row.address)) issues.push('address');

  const bp = boarding && typeof boarding === 'object' ? boarding : null;
  if (!bp || isDashOrBlank(bp.address)) issues.push('boardingPoint');
  else if (!bp.coordinates || typeof bp.lat !== 'number' || typeof bp.lng !== 'number') {
    issues.push('boardingCoords');
  }

  const ap = alighting && typeof alighting === 'object' ? alighting : null;
  if (!ap || isDashOrBlank(ap.address)) issues.push('alightingPoint');

  if (!row.route_id) issues.push('noRouteLinked');

  if (isPlaceholderPhoto(row.photo)) issues.push('photo');

  if (!responsible || typeof responsible !== 'object') {
    issues.push('responsible');
  } else {
    if (isDashOrBlank(responsible.name)) issues.push('responsibleName');
    const cpf = String(responsible.cpf ?? '').replace(/\D/g, '');
    if (cpf.length < 11) issues.push('responsibleCpf');
    const phone = String(responsible.phone ?? '').replace(/\D/g, '');
    if (phone.length < 10) issues.push('responsiblePhone');
    const email = (responsible.email ?? '').trim();
    if (!email.includes('@')) issues.push('responsibleEmail');
  }

  return { issues, bp };
}

try {
  const students = await prisma.$queryRaw`
    SELECT s.id, s.name, s.registration_number, s.birth_date, s.grade, s.shift, s.status,
           s.school_id, s.municipality_id, s.address, s.boarding_point, s.alighting_point,
           s.responsible, s.route_id, s.photo,
           sch.name AS school_name,
           r.name AS route_name
    FROM "Student" s
    LEFT JOIN "School" sch ON sch.id = s.school_id
    LEFT JOIN "Route" r ON r.id = s.route_id
    ORDER BY s.name ASC`;

  const total = students.length;
  const byStatus = {};
  const issueCounts = {};
  const incompleteList = [];
  const noRoute = [];
  const noBoarding = [];
  const noAddress = [];

  for (const s of students) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const { issues } = auditStudent(s);
    if (issues.length > 0) {
      incompleteList.push({ name: s.name, mat: s.registration_number, issues, route: s.route_name, school: s.school_name });
      for (const i of issues) issueCounts[i] = (issueCounts[i] ?? 0) + 1;
    }
    if (!s.route_id) noRoute.push(s);
    const bp = s.boarding_point;
    const bpObj = bp && typeof bp === 'object' ? bp : null;
    if (!bpObj || isDashOrBlank(bpObj.address)) noBoarding.push(s);
    if (isDashOrBlank(s.address)) noAddress.push(s);
  }

  const completeUi = students.filter((s) => {
    const { issues } = auditStudent(s);
    const uiFields = issues.filter(
      (x) =>
        !['photo', 'responsibleCpf', 'responsiblePhone', 'responsibleEmail', 'responsibleName'].includes(x) &&
        x !== 'boardingCoords'
    );
    return uiFields.length === 0;
  });

  const fullCadastro = students.filter((s) => auditStudent(s).issues.length === 0);
  const withRoute = students.filter((s) => s.route_id);
  const routeOrphans = [];
  for (const s of withRoute) {
    const r = await prisma.$queryRaw`SELECT id, name FROM "Route" WHERE id = ${s.route_id}`;
    if (!r.length) routeOrphans.push(s);
  }

  // Rotas sugeridas: aluno sem route_id mas mesma escola+turno+municipio que alguma rota
  const suggestable = [];
  for (const s of noRoute) {
    const routes = await prisma.$queryRaw`
      SELECT id, name FROM "Route"
      WHERE municipality_id = ${s.municipality_id}
        AND school_id = ${s.school_id}
        AND shift = ${s.shift}
      ORDER BY name`;
    if (routes.length > 0) {
      suggestable.push({
        name: s.name,
        mat: s.registration_number,
        school: s.school_name,
        shift: s.shift,
        possibleRoutes: routes.map((r) => r.name),
      });
    }
  }

  console.log('=== TOTAL ALUNOS ===', total);
  console.log('Por status:', byStatus);
  console.log('\n=== VÍNCULO ROTA (route_id) ===');
  console.log({ comRotaVinculada: withRoute.length, semRota: noRoute.length });
  console.log('\n=== CADASTRO COMPLETO (regra ampla do script) ===', fullCadastro.length, 'de', total);
  console.log('=== SEM alertas principais (endereço+parada+escola, foto/responsável podem faltar) ===', completeUi.length);
  console.log('\n=== Problemas mais frequentes ===', issueCounts);
  console.log('\n=== Sem endereço (campo address) ===', noAddress.length);
  console.log('\n=== Sem parada de embarque ===', noBoarding.length);
  console.log('\n=== Sem rota vinculada — COM rota possível (mesma escola/turno) ===', suggestable.length);
  for (const x of suggestable.slice(0, 15)) {
    console.log(`- ${x.name} (${x.mat}) | ${x.school} | rotas: ${x.possibleRoutes.join(', ')}`);
  }
  if (suggestable.length > 15) console.log(`... e mais ${suggestable.length - 15}`);

  console.log('\n=== Sem rota e SEM rota candidata (escola/turno sem rota cadastrada) ===');
  const noSuggest = noRoute.filter((s) => {
    return !suggestable.find((x) => x.mat === s.registration_number);
  });
  console.log('count:', noSuggest.length);
  for (const s of noSuggest.slice(0, 10)) {
    console.log(`- ${s.name} | ${s.school_name} | turno ${s.shift}`);
  }

  console.log('\n=== Amostra cadastros incompletos (até 12) ===');
  for (const x of incompleteList.slice(0, 12)) {
    console.log(JSON.stringify(x));
  }

  console.log('\n=== route_id apontando rota inexistente ===', routeOrphans.length);
} finally {
  await prisma.$disconnect();
}

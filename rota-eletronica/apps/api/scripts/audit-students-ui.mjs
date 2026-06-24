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

function uiIssues(s) {
  const issues = [];
  if (isDashOrBlank(s.name)) issues.push('name');
  if (isDashOrBlank(s.registrationNumber)) issues.push('registrationNumber');
  if (isDashOrBlank(s.birthDate)) issues.push('birthDate');
  if (isDashOrBlank(s.grade)) issues.push('grade');
  if (!s.schoolId) issues.push('schoolId');
  if (!s.municipalityId) issues.push('municipalityId');
  if (isDashOrBlank(s.address)) issues.push('address');
  if (!s.boardingPoint || isDashOrBlank(s.boardingPoint.address)) issues.push('boardingPoint');
  if (!s.alightingPoint || isDashOrBlank(s.alightingPoint.address)) issues.push('alightingPoint');
  const r = s.responsible;
  if (!r || isDashOrBlank(r.name)) issues.push('responsibleName');
  if (r && isDashOrBlank(r.relationship)) issues.push('responsibleRelationship');
  if (r) {
    if ((r.cpf ?? '').replace(/\D/g, '').length < 11) issues.push('responsibleCpf');
    const phone = (r.phone ?? '').replace(/\D/g, '');
    if (isDashOrBlank(r.phone) || phone.length < 10) issues.push('responsiblePhone');
    const email = (r.email ?? '').trim();
    if (isDashOrBlank(r.email) || !email.includes('@')) issues.push('responsibleEmail');
  }
  if (isPlaceholderPhoto(s.photo)) issues.push('photo');
  return issues;
}

try {
  const students = await prisma.$queryRaw`
    SELECT s.*, sch.name AS school_name, r.name AS route_name
    FROM "Student" s
    LEFT JOIN "School" sch ON sch.id = s.school_id
    LEFT JOIN "Route" r ON r.id = s.route_id
    ORDER BY s.name ASC`;

  const uiComplete = [];
  const uiIncomplete = [];
  const noRoute = [];

  for (const row of students) {
    const s = {
      name: row.name,
      registrationNumber: row.registration_number,
      birthDate: row.birth_date,
      grade: row.grade,
      schoolId: row.school_id,
      municipalityId: row.municipality_id,
      address: row.address,
      boardingPoint: row.boarding_point,
      alightingPoint: row.alighting_point,
      responsible: row.responsible,
      photo: row.photo,
      routeId: row.route_id,
      shift: row.shift,
    };
    const issues = uiIssues(s);
    if (issues.length === 0) uiComplete.push(s);
    else uiIncomplete.push({ name: s.name, mat: s.registrationNumber, issues, route: row.route_name ?? null });
    if (!s.routeId) {
      const routes = await prisma.$queryRaw`
        SELECT name FROM "Route"
        WHERE municipality_id = ${row.municipality_id}
          AND school_id = ${row.school_id}
          AND shift = ${row.shift}
        ORDER BY name`;
      noRoute.push({
        name: s.name,
        mat: s.registrationNumber,
        school: row.school_name,
        shift: s.shift,
        rotasPossiveis: routes.map((r) => r.name),
      });
    }
  }

  console.log('TOTAL', students.length);
  console.log('Cadastro completo (regra da tela Alunos)', uiComplete.length);
  console.log('Com rota vinculada (routeId)', students.filter((s) => s.route_id).length);
  console.log(
    'Endereço + parada embarque + desembarque OK',
    students.filter((row) => {
      const s = {
        address: row.address,
        boardingPoint: row.boarding_point,
        alightingPoint: row.alighting_point,
        name: row.name,
        registrationNumber: row.registration_number,
        birthDate: row.birth_date,
        grade: row.grade,
        schoolId: row.school_id,
        municipalityId: row.municipality_id,
        responsible: row.responsible,
        photo: row.photo,
      };
      const i = uiIssues(s);
      return !i.some((x) => ['address', 'boardingPoint', 'alightingPoint'].includes(x));
    }).length
  );
  console.log('\nSem rota vinculada:', noRoute.length);
  for (const x of noRoute) console.log(JSON.stringify(x));
  console.log('\nIncompletos na UI:', uiIncomplete.length);
  for (const x of uiIncomplete) console.log(JSON.stringify(x));
} finally {
  await prisma.$disconnect();
}

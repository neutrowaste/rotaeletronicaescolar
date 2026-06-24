import { PrismaClient } from '@prisma/client';

const ROUTE_NAME = process.argv[2] ?? '25 MAT 01';

const prisma = new PrismaClient();

function countStudentIdsFromStops(stopsRaw) {
  if (!Array.isArray(stopsRaw)) return new Set();
  const ids = new Set();
  for (const stop of stopsRaw) {
    if (!stop || typeof stop !== 'object') continue;
    const studentsIds = stop.studentsIds;
    if (!Array.isArray(studentsIds)) continue;
    for (const id of studentsIds) {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    }
  }
  return ids;
}

try {
  const routes = await prisma.$queryRaw`
    SELECT r.id, r.name, r.shift, r.status, r.municipality_id AS "municipalityId",
           r.school_id AS "schoolId", r.total_students AS "totalStudents",
           r.total_stops AS "totalStops", r.stops,
           m.name AS "municipalityName", s.name AS "schoolName"
    FROM "Route" r
    LEFT JOIN "Municipality" m ON m.id = r.municipality_id
    LEFT JOIN "School" s ON s.id = r.school_id
    WHERE r.name ILIKE ${'%' + ROUTE_NAME.replace(/\s+/g, '%') + '%'}
    ORDER BY r.name ASC
    LIMIT 5`;
  const route = routes[0];

  if (!route) {
    const all = await prisma.route.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 30,
    });
    console.log('Rota não encontrada:', ROUTE_NAME);
    console.log('Rotas no banco (amostra):', all.map((r) => r.name).join(' | '));
    process.exit(1);
  }

  const linked = await prisma.student.findMany({
    where: { routeId: route.id },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      shift: true,
      status: true,
      schoolId: true,
      municipalityId: true,
    },
    orderBy: { name: 'asc' },
  });

  const eligibleUnassigned = await prisma.student.findMany({
    where: {
      routeId: null,
      municipalityId: route.municipalityId,
      schoolId: route.schoolId,
      shift: route.shift,
    },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      shift: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  });

  const dbCount = await prisma.student.count({
    where: {
      OR: [
        { routeId: route.id },
        {
          routeId: null,
          municipalityId: route.municipalityId,
          schoolId: route.schoolId,
          shift: route.shift,
        },
      ],
    },
  });

  const stopIds = countStudentIdsFromStops(route.stops);
  const stops = Array.isArray(route.stops) ? route.stops : [];

  const stopDetails = stops.map((s, i) => ({
    order: s?.order ?? i + 1,
    address: s?.address ?? '',
    studentsIds: Array.isArray(s?.studentsIds) ? s.studentsIds : [],
    count: Array.isArray(s?.studentsIds) ? s.studentsIds.length : 0,
  }));

  const effectiveTotal = Math.max(dbCount, stopIds.size);

  console.log('=== ROTA ===');
  console.log(JSON.stringify({
    id: route.id,
    name: route.name,
    shift: route.shift,
    status: route.status,
    municipality: route.municipalityName,
    school: route.schoolName,
    totalStudentsField: route.totalStudents,
    totalStops: route.totalStops,
  }, null, 2));

  console.log('\n=== CONTAGENS (regra da API / listagem) ===');
  console.log({
    vinculados_routeId: linked.length,
    elegiveis_sem_rota_mesmo_mun_escola_turno: eligibleUnassigned.length,
    count_prisma_OR: dbCount,
    ids_unicos_nas_paradas: stopIds.size,
    total_efetivo_Math_max: effectiveTotal,
    exibicao_listagem_esperada:
      linked.length > 0 && effectiveTotal > 0 && linked.length !== effectiveTotal
        ? `${linked.length} / ${effectiveTotal}`
        : String(linked.length > 0 ? linked.length : effectiveTotal),
  });

  console.log('\n=== ALUNOS VINCULADOS (routeId = rota) —', linked.length, '===');
  for (const s of linked) {
    console.log(`- ${s.name} | mat: ${s.registrationNumber} | status: ${s.status} | id: ${s.id}`);
  }

  console.log('\n=== ALUNOS SEM ROTA, MESMO MUN/ESCOLA/TURNO —', eligibleUnassigned.length, '===');
  for (const s of eligibleUnassigned) {
    console.log(`- ${s.name} | mat: ${s.registrationNumber} | status: ${s.status} | id: ${s.id}`);
  }

  console.log('\n=== IDs NAS PARADAS (studentsIds) —', stopIds.size, 'únicos ===');
  if (stopIds.size > 0) {
    const inStops = await prisma.student.findMany({
      where: { id: { in: [...stopIds] } },
      select: { id: true, name: true, routeId: true, registrationNumber: true },
    });
    const byId = new Map(inStops.map((s) => [s.id, s]));
    for (const id of stopIds) {
      const s = byId.get(id);
      console.log(
        s
          ? `- ${s.name} | mat: ${s.registrationNumber} | routeId: ${s.routeId ?? '(null)'} | id: ${id}`
          : `- (ID não encontrado no cadastro) ${id}`
      );
    }
  } else {
    console.log('(nenhum studentsIds nas paradas)');
  }

  console.log('\n=== PARADAS (resumo) ===');
  for (const p of stopDetails) {
    console.log(`Parada ${p.order}: ${p.count} aluno(s) — ${p.address.slice(0, 60)}`);
  }

  const linkedSet = new Set(linked.map((s) => s.id));
  const eligibleSet = new Set(eligibleUnassigned.map((s) => s.id));
  const onlyEligible = eligibleUnassigned.filter((s) => !linkedSet.has(s.id));
  const onlyInStops = [...stopIds].filter((id) => !linkedSet.has(id) && !eligibleSet.has(id));

  if (onlyEligible.length) {
    console.log('\n=== Entram no 6 mas NÃO estão vinculados (só elegíveis sem rota) ===');
    for (const s of onlyEligible) console.log(`- ${s.name} (${s.id})`);
  }
  if (onlyInStops.length) {
    console.log('\n=== Só nas paradas (IDs sem vínculo nem elegível OR) ===');
    for (const id of onlyInStops) console.log(`- ${id}`);
  }
} finally {
  await prisma.$disconnect();
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function countStudentIdsFromStops(stopsRaw) {
  if (!Array.isArray(stopsRaw)) return 0;
  const ids = new Set();
  for (const stop of stopsRaw) {
    if (!stop?.studentsIds || !Array.isArray(stop.studentsIds)) continue;
    for (const id of stop.studentsIds) {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    }
  }
  return ids.size;
}

try {
  const routes = await prisma.$queryRaw`
    SELECT id, name, shift, municipality_id AS "municipalityId", school_id AS "schoolId",
           total_students AS "totalStudentsStored", stops
    FROM "Route"
    ORDER BY name ASC`;

  const allStudents = await prisma.student.findMany({
    select: {
      id: true,
      routeId: true,
      municipalityId: true,
      schoolId: true,
      shift: true,
      status: true,
    },
  });

  const linkedByRoute = new Map();
  for (const s of allStudents) {
    if (s.routeId) {
      linkedByRoute.set(s.routeId, (linkedByRoute.get(s.routeId) ?? 0) + 1);
    }
  }

  const rows = [];
  for (const r of routes) {
    const linked = linkedByRoute.get(r.id) ?? 0;
    const eligibleUnassigned = allStudents.filter(
      (s) =>
        !s.routeId &&
        s.municipalityId === r.municipalityId &&
        s.schoolId === r.schoolId &&
        s.shift === r.shift
    ).length;
    const fromStops = countStudentIdsFromStops(r.stops);
    const apiEffective = Math.max(linked + eligibleUnassigned, fromStops);
    // API uses OR count which equals linked + eligible when no overlap
    const orCount =
      linked +
      allStudents.filter(
        (s) =>
          (s.routeId === r.id ||
            (!s.routeId &&
              s.municipalityId === r.municipalityId &&
              s.schoolId === r.schoolId &&
              s.shift === r.shift)) &&
          s.routeId !== r.id
      ).length === eligibleUnassigned
        ? linked + eligibleUnassigned
        : linked + eligibleUnassigned;

    const displayMismatch = linked > 0 && apiEffective > 0 && linked !== apiEffective;
    const onlyEligible = eligibleUnassigned > 0 && linked < apiEffective;

    rows.push({
      name: r.name,
      shift: r.shift,
      linked,
      eligibleUnassigned,
      fromStops,
      apiEffective,
      stored: Number(r.totalStudentsStored) || 0,
      display: displayMismatch ? `${linked} / ${apiEffective}` : String(linked || apiEffective),
      mismatch: displayMismatch,
      onlyEligible,
    });
  }

  const mismatches = rows.filter((x) => x.mismatch);
  const ok = rows.filter((x) => !x.mismatch);

  console.log('=== RESUMO ===');
  console.log({
    totalRotas: rows.length,
    rotasComFormato_X_Y: mismatches.length,
    rotasNumeroUnico: ok.length,
  });

  console.log('\n=== ROTAS COM 2/6 OU X/Y (vinculados ≠ total API) ===');
  for (const x of mismatches) {
    console.log(JSON.stringify(x));
  }

  console.log('\n=== ROTA 25 MAT01 (detalhe) ===');
  console.log(JSON.stringify(rows.find((x) => x.name === '25 MAT01'), null, 2));

  console.log('\n=== AMOSTRA ROTAS “OK” (número único) ===');
  for (const x of ok.slice(0, 8)) {
    console.log(JSON.stringify(x));
  }

  // Schools with multiple routes same shift - common cause of eligible pool
  const schoolShiftRoutes = new Map();
  for (const r of routes) {
    const key = `${r.schoolId}|${r.shift}`;
    if (!schoolShiftRoutes.has(key)) schoolShiftRoutes.set(key, []);
    schoolShiftRoutes.get(key).push(r.name);
  }
  const mat01 = routes.find((r) => r.name === '25 MAT01');
  if (mat01) {
    const key = `${mat01.schoolId}|${mat01.shift}`;
    console.log('\n=== Rotas mesma escola + turno que 25 MAT01 ===');
    console.log(schoolShiftRoutes.get(key));
    const unassignedPool = allStudents.filter(
      (s) =>
        !s.routeId &&
        s.municipalityId === mat01.municipalityId &&
        s.schoolId === mat01.schoolId &&
        s.shift === mat01.shift
    );
    console.log('Alunos SEM rota nesse pool (compartilhado entre essas rotas):', unassignedPool.length);
  }

  // Compare: routes with linked>0 but eligible=0
  const linkedOnly = rows.filter((x) => x.linked > 0 && x.eligibleUnassigned === 0);
  console.log('\n=== Rotas só com vinculados (sem “fila” sem rota) —', linkedOnly.length, '===');
  for (const x of linkedOnly.slice(0, 10)) {
    console.log(`- ${x.name}: linked=${x.linked} display=${x.display}`);
  }
} finally {
  await prisma.$disconnect();
}

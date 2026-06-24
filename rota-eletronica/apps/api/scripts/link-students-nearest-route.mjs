/**
 * Vincula alunos sem route_id à rota cuja parada de embarque está mais próxima da casa
 * (mesma regra de stopsService / cadastro de aluno: parada mais próxima → routeId).
 *
 * Uso: node scripts/link-students-nearest-route.mjs [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { normalizeShiftToPeriod } from '@rota-eletronica/shared-types';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function parseStops(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function homeCoordinates(boardingPoint) {
  const bp = boardingPoint && typeof boardingPoint === 'object' ? boardingPoint : null;
  const c = bp?.coordinates;
  if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return c;
  if (typeof bp?.lat === 'number' && typeof bp?.lng === 'number') return { lat: bp.lat, lng: bp.lng };
  return null;
}

/** Parada mais próxima entre rotas da mesma escola/turno/município. */
function findNearestStop(routes, student) {
  const home = homeCoordinates(student.boarding_point);
  if (!home) return null;

  const period = normalizeShiftToPeriod(student.shift);
  const eligible = routes.filter(
    (r) =>
      r.municipality_id === student.municipality_id &&
      r.school_id === student.school_id &&
      normalizeShiftToPeriod(r.shift) === period
  );

  let best = null;
  for (const route of eligible) {
    for (const stop of parseStops(route.stops)) {
      const c = stop?.coordinates;
      if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
      const distanceMeters = Math.round(distanceKm(c, home) * 1000);
      if (!best || distanceMeters < best.distanceMeters) {
        best = {
          routeId: route.id,
          routeName: route.name,
          stopAddress: stop.address ?? '',
          stopOrder: stop.order,
          coordinates: c,
          distanceMeters,
        };
      }
    }
  }
  return best;
}

try {
  const students = await prisma.$queryRaw`
    SELECT s.id, s.name, s.registration_number, s.shift, s.municipality_id, s.school_id,
           s.boarding_point, s.route_id
    FROM "Student" s
    WHERE s.route_id IS NULL
    ORDER BY s.name`;

  const routes = await prisma.$queryRaw`
    SELECT id, name, municipality_id, school_id, shift, stops
    FROM "Route"`;

  if (students.length === 0) {
    console.log('Nenhum aluno sem rota vinculada.');
    process.exit(0);
  }

  console.log(dryRun ? '=== DRY RUN ===' : '=== VINCULANDO ===');
  console.log('Alunos sem rota:', students.length);

  let updated = 0;
  let skipped = 0;

  for (const s of students) {
    const nearest = findNearestStop(routes, s);
    if (!nearest) {
      skipped++;
      console.log(`SKIP ${s.name} (${s.registration_number}): sem parada/rota compatível ou sem coordenadas`);
      continue;
    }

    const bp = s.boarding_point && typeof s.boarding_point === 'object' ? { ...s.boarding_point } : {};
    const newBoarding = {
      ...bp,
      address: nearest.stopAddress || bp.address,
      coordinates: nearest.coordinates,
      distanceMeters: nearest.distanceMeters,
    };

    console.log(
      `${dryRun ? 'WOULD' : 'OK'} ${s.name} (${s.registration_number}) → ${nearest.routeName} ` +
        `(${nearest.distanceMeters} m, parada ordem ${nearest.stopOrder ?? '?'})`
    );

    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE "Student"
        SET route_id = ${nearest.routeId},
            boarding_point = ${JSON.stringify(newBoarding)}::jsonb,
            updated_at = NOW()
        WHERE id = ${s.id}`;
      updated++;
    }
  }

  console.log('\nResumo:', { atualizados: dryRun ? 0 : updated, ignorados: skipped, total: students.length });
} finally {
  await prisma.$disconnect();
}

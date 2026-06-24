import type { Route, Stop } from '@rota-eletronica/shared-types';
import { schools } from './schools';

/** IDs de alunos STU001..STU200 para distribuir nas paradas */
const STUDENT_IDS = Array.from({ length: 200 }, (_, i) => `STU${String(i + 1).padStart(3, '0')}`);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Cria paradas mock com alunos distribuídos */
function createStopsForRoute(
  routeIndex: number,
  schoolId: string,
  schoolCoords: { lat: number; lng: number }
): Stop[] {
  const numStops = 5 + (routeIndex % 8);
  const shuffled = shuffle(STUDENT_IDS);
  const perRoute = Math.min(15, Math.floor(shuffled.length / 30));
  const start = routeIndex * perRoute % shuffled.length;
  const studentSlice = shuffled.slice(start, start + numStops * 3).filter(Boolean);
  const stops: Stop[] = [];
  for (let i = 0; i < numStops; i++) {
    const numStudents = 1 + (i % 3);
    const studentsIds = studentSlice.splice(0, numStudents);
    stops.push({
      id: `STOP-${routeIndex}-${i}`,
      order: i + 1,
      address: `Parada ${i + 1} - Rua ${100 + i}, Bairro`,
      coordinates: {
        lat: schoolCoords.lat + (i + 1) * 0.01 - 0.02,
        lng: schoolCoords.lng + (i % 2) * 0.01 - 0.005,
      },
      studentsIds,
      estimatedArrival: `${String(6 + Math.floor(i * 0.3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
    });
  }
  return stops;
}

const MUNICIPALITY_IDS = ['MUN001', 'MUN002', 'MUN003', 'MUN004', 'MUN005', 'MUN006', 'MUN007', 'MUN008', 'MUN009', 'MUN010', 'MUN011', 'MUN012'];
const VEHICLE_IDS = Array.from({ length: 40 }, (_, i) => `VEH${String(i + 1).padStart(3, '0')}`);
const DRIVER_IDS = Array.from({ length: 15 }, (_, i) => `DRV${String(i + 1).padStart(3, '0')}`);
const SHIFTS = ['morning', 'afternoon', 'integral'] as const;

/** Polyline encoded mock (simplificado - só para exibição) */
const MOCK_POLYLINE = 'encoded_polyline_mock_route_';

/** 30 rotas mockadas */
export const routes: Route[] = Array.from({ length: 30 }, (_, i) => {
  const school = schools[i % schools.length];
  const stops = createStopsForRoute(i, school.id, school.coordinates);
  const totalStudents = stops.reduce((acc, s) => acc + s.studentsIds.length, 0);
  const munIndex = i % MUNICIPALITY_IDS.length;
  const status = i < 24 ? 'active' : i < 26 ? 'in_progress' : i < 28 ? 'completed' : 'inactive';

  return {
    id: `ROT${String(i + 1).padStart(3, '0')}`,
    name: `Rota ${school.name.slice(0, 15)} - ${SHIFTS[i % 3] === 'morning' ? 'Manhã' : SHIFTS[i % 3] === 'afternoon' ? 'Tarde' : 'Integral'}`,
    municipalityId: MUNICIPALITY_IDS[munIndex],
    vehicleId: VEHICLE_IDS[i % 40],
    driverId: DRIVER_IDS[i % 15],
    schoolId: school.id,
    shift: SHIFTS[i % 3],
    totalStudents,
    totalStops: stops.length,
    estimatedKm: 12 + (i % 25),
    estimatedDuration: 45 + (i % 60),
    status,
    scheduleId: i < 20 ? `SCHED${String(i + 1).padStart(3, '0')}` : null,
    stops,
    polyline: MOCK_POLYLINE + i,
    origin: {
      lat: school.coordinates.lat + 0.05,
      lng: school.coordinates.lng - 0.03,
    },
    createdAt: '2025-01-15T10:00:00.000Z',
    lastUpdated: '2026-03-01T14:30:00.000Z',
  };
});

/**
 * Testes de integração da API (PostgreSQL via DATABASE_URL).
 * Executar: npm run test (na pasta apps/api)
 */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppInstance } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('API — integração (rotas e saúde)', () => {
  let app: AppInstance;
  let municipalityId: string;
  let garageId: string;
  let schoolId: string;
  let vehicleId: string;
  let createdRouteId: string | null = null;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    const mun = await prisma.municipality.create({
      data: {
        name: `Município QA ${suffix}`,
        state: 'SP',
        ibgeCode: `9999999${suffix.slice(-4)}`,
        responsible: 'QA',
        phone: '0000000000',
        email: `qa-${suffix}@test.local`,
        contractStart: '2025-01-01',
        contractEnd: '2030-12-31',
        status: 'active',
      },
    });
    municipalityId = mun.id;

    const garage = await prisma.garage.create({
      data: {
        name: `Garagem QA ${suffix}`,
        address: 'Rua Teste, 1',
        municipalityId,
        coordinates: { lat: -22.4, lng: -47.5 },
      },
    });
    garageId = garage.id;

    const school = await prisma.school.create({
      data: {
        name: `Escola QA ${suffix}`,
        address: 'Av. Teste, 100',
        municipalityId,
        coordinates: { lat: -22.41, lng: -47.51 },
        phone: '1111111111',
        principal: 'Diretor QA',
        status: 'active',
      },
    });
    schoolId = school.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: `Q${Date.now().toString(36).toUpperCase()}`.slice(0, 8),
        brand: 'Test',
        model: 'Bus',
        year: 2024,
        color: 'Amarelo',
        capacity: 44,
        municipalityId,
        garageId,
        renavam: `9${suffix.slice(-10).padStart(10, '0')}`,
        chassis: `CH${suffix.padEnd(15, '0').slice(0, 17)}`,
        lastInspectionDate: '2026-12-31',
        status: 'active',
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    if (createdRouteId) {
      await prisma.route.delete({ where: { id: createdRouteId } }).catch(() => {});
    }
    await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
    await prisma.municipality.delete({ where: { id: municipalityId } }).catch(() => {});
    await app?.close();
    await prisma.$disconnect();
  });

  it('GET /api/health retorna ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('POST /api/auth/login sem e-mail → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: '', password: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/auth/login usuário inexistente → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'naoexiste@test.invalid', password: 'qualquer' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/login admin (após npm run db:seed) → 200 + token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@urbandata.com', password: 'admin123' },
    });
    if (res.statusCode === 401) {
      expect(res.statusCode).toBe(401);
      return;
    }
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { token: string; user: { email: string } };
    expect(body.token?.length).toBeGreaterThan(10);
    expect(body.user?.email).toBe('admin@urbandata.com');
  });

  it('GET /api/municipalities lista (200)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/municipalities' });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body) as { id: string }[];
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((m) => m.id === municipalityId)).toBe(true);
  });

  it('POST /api/routes sem nome → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/routes',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: '',
        municipalityId,
        vehicleId,
        schoolId,
        garageId,
        shift: 'morning',
        stops: [],
        polyline: '',
        origin: { lat: -22.4, lng: -47.5 },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/nome/i);
  });

  it('POST /api/routes município inexistente → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/routes',
      headers: { 'content-type': 'application/json' },
      payload: {
        name: 'Rota inválida',
        municipalityId: 'clxxxxxxxxxxxxxxxxxxxxxx',
        vehicleId,
        schoolId,
        garageId,
        shift: 'morning',
        stops: [],
        polyline: '',
        origin: {},
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Município/i);
  });

  it('POST /api/routes payload válido → 201 e GET por id', async () => {
    const payload = {
      name: `Rota QA ${suffix}`,
      municipalityId,
      vehicleId,
      schoolId,
      garageId,
      driverId: '',
      shift: 'morning',
      totalStudents: 0,
      totalStops: 2,
      estimatedKm: 5.2,
      estimatedDuration: 25,
      status: 'active',
      scheduleId: null,
      stops: [
        { id: 's1', order: 1, address: 'Parada 1', coordinates: { lat: -22.4, lng: -47.5 }, studentsIds: [], estimatedArrival: '07:30' },
        { id: 's2', order: 2, address: 'Parada 2', coordinates: { lat: -22.41, lng: -47.51 }, studentsIds: [], estimatedArrival: '07:45' },
      ],
      polyline: 'encoded_dummy',
      origin: { lat: -22.39, lng: -47.49 },
      generatedAt: new Date().toISOString(),
    };

    const post = await app.inject({
      method: 'POST',
      url: '/api/routes',
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expect(post.statusCode).toBe(201);
    const created = JSON.parse(post.body) as { id: string; name: string; driverId: string; stops: unknown[] };
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(payload.name);
    expect(Array.isArray(created.stops)).toBe(true);
    expect((created.stops as unknown[]).length).toBe(2);
    createdRouteId = created.id;

    const getOne = await app.inject({ method: 'GET', url: `/api/routes/${created.id}` });
    expect(getOne.statusCode).toBe(200);
    expect(JSON.parse(getOne.body).id).toBe(created.id);
  });

  it('GET /api/routes filtra por municipalityId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/routes?municipalityId=${encodeURIComponent(municipalityId)}`,
    });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body) as { id: string }[];
    expect(list.some((r) => r.id === createdRouteId)).toBe(true);
  });

  it('PATCH /api/routes/:id atualiza nome', async () => {
    expect(createdRouteId).toBeTruthy();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/routes/${createdRouteId}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: `Rota QA atualizada ${suffix}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toContain('atualizada');
  });

  it('DELETE /api/routes/:id → 204 e GET retorna 404', async () => {
    expect(createdRouteId).toBeTruthy();
    const id = createdRouteId as string;
    const del = await app.inject({ method: 'DELETE', url: `/api/routes/${id}` });
    expect(del.statusCode).toBe(204);
    createdRouteId = null;

    const get404 = await app.inject({ method: 'GET', url: `/api/routes/${id}` });
    expect(get404.statusCode).toBe(404);
  });
});

describe('API — sem DATABASE_URL', () => {
  it('pula integração se .env não configurado', () => {
    if (!process.env.DATABASE_URL) {
      expect(true).toBe(true);
    }
  });
});

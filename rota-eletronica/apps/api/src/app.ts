import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import authRoutes from './routes/auth.js';
import authBootstrapRoutes from './routes/authBootstrap.js';
import municipalitiesRoutes from './routes/municipalities.js';
import municipalityBrasaoRoutes from './routes/municipalityBrasao.js';
import schoolsRoutes from './routes/schools.js';
import garagesRoutes from './routes/garages.js';
import vehiclesRoutes from './routes/vehicles.js';
import driversRoutes from './routes/drivers.js';
import studentsRoutes from './routes/students.js';
import routesRoutes from './routes/routes.js';
import schedulesRoutes from './routes/schedules.js';
import monitoringRoutes from './routes/monitoring.js';
import usuariosRoutes from './routes/usuarios.js';
import perfilPermissoesRoutes from './routes/perfilPermissoes.js';
import { ensureMunicipalityResponsibleRoleColumn } from './lib/prisma.js';

export type AppInstance = Awaited<ReturnType<typeof buildApp>>;

/** Monta a aplicação Fastify (sem listen) — usada em testes com inject(). */
export async function buildApp(options?: { logger?: boolean }) {
  await ensureMunicipalityResponsibleRoleColumn();

  const app = Fastify({ logger: options?.logger ?? false });
  await app.register(cors, { origin: true });

  await app.register(multipart, {
    limits: { fileSize: 3 * 1024 * 1024 },
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
  });

  await app.register(authBootstrapRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(municipalitiesRoutes, { prefix: '/api' });
  await app.register(municipalityBrasaoRoutes, { prefix: '/api' });
  await app.register(schoolsRoutes, { prefix: '/api' });
  await app.register(garagesRoutes, { prefix: '/api' });
  await app.register(vehiclesRoutes, { prefix: '/api' });
  await app.register(driversRoutes, { prefix: '/api' });
  await app.register(studentsRoutes, { prefix: '/api' });
  await app.register(routesRoutes, { prefix: '/api' });
  await app.register(schedulesRoutes, { prefix: '/api' });
  await app.register(monitoringRoutes, { prefix: '/api' });
  await app.register(usuariosRoutes, { prefix: '/api' });
  await app.register(perfilPermissoesRoutes, { prefix: '/api' });

  app.get('/api/health', async (_request, reply) => {
    return reply.send({ ok: true });
  });

  return app;
}

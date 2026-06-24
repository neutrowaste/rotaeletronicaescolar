import { PrismaClient } from '../../node_modules/.prisma/api-client/index.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Bases criadas antes do campo Cargo/Função: garante coluna no PostgreSQL. */
export async function ensureMunicipalityResponsibleRoleColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Municipality" ADD COLUMN IF NOT EXISTS "responsible_role" TEXT;`
    );
  } catch (e) {
    console.warn('[prisma] ensure responsible_role:', e);
  }
}

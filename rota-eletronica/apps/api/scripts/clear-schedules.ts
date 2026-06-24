/**
 * Remove todas as escalas (tabela Schedule). Incidentes ligados à escala são removidos em cascata.
 * Não altera rotas, motoristas, veículos nem outros cadastros.
 *
 * Uso: npm run db:clear-schedules (na pasta apps/api)
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/api-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.schedule.deleteMany({});
  console.log(`Removidas ${deleted.count} escala(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

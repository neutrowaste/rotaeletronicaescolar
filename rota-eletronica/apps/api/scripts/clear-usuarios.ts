/**
 * Remove todos os usuários do painel e auditoria relacionada.
 * Uso: npx tsx scripts/clear-usuarios.ts (na pasta apps/api)
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/api-client/index.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.route.updateMany({ where: { createdBy: { not: null } }, data: { createdBy: null } });
  const deletedAudit = await prisma.usuarioAuditoria.deleteMany({});
  const deletedUsers = await prisma.usuario.deleteMany({});
  console.log(`Removidos: ${deletedUsers.count} usuário(s), ${deletedAudit.count} registro(s) de auditoria.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

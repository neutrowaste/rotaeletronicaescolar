import { prisma } from '../src/lib/prisma.js';

async function main() {
  const rows = await prisma.usuario.findMany({
    select: {
      nomeCompleto: true,
      login: true,
      email: true,
      perfil: true,
      status: true,
    },
    orderBy: { nomeCompleto: 'asc' },
  });
  console.log(JSON.stringify(rows, null, 2));
  const byPerfil = await prisma.usuario.groupBy({
    by: ['perfil'],
    _count: true,
  });
  console.log('--- por perfil ---');
  console.log(JSON.stringify(byPerfil, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

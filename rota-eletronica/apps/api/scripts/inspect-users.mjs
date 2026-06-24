import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const users = await prisma.usuario.findMany({
    take: 10,
    select: {
      id: true,
      login: true,
      email: true,
      perfil: true,
      usuarioMunicipios: { select: { municipioId: true } },
    },
  });
  console.log(JSON.stringify(users, null, 2));
} finally {
  await prisma.$disconnect();
}

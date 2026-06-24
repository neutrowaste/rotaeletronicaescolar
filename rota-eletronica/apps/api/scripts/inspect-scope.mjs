import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const munCount = await prisma.municipality.count();
  const allMunIds = new Set(
    (await prisma.municipality.findMany({ select: { id: true } })).map((m) => m.id)
  );
  const drivers = await prisma.driver.findMany({ select: { id: true, name: true, municipalityIds: true } });
  const invalid = drivers.filter((d) => {
    const ids = Array.isArray(d.municipalityIds) ? d.municipalityIds : [];
    return ids.length === 0 || ids.every((id) => !allMunIds.has(id));
  });
  const users = await prisma.$queryRaw`
    SELECT u.login, u.perfil, array_agg(um.municipio_id) as municipio_ids
    FROM usuarios u
    LEFT JOIN usuario_municipios um ON um.usuario_id = u.id
    GROUP BY u.id, u.login, u.perfil
    LIMIT 15`;
  console.log('municipality_count', munCount);
  console.log('drivers_with_no_valid_mun', invalid.length, invalid.map((d) => d.name));
  console.log('users', JSON.stringify(users, null, 2));

  const allow = new Set(['cmougwxlk0002ptyqv6ep0x3m']);
  const scoped = drivers.filter((d) => {
    const ids = Array.isArray(d.municipalityIds) ? d.municipalityIds : [];
    return ids.some((id) => allow.has(id));
  });
  console.log('drivers_total', drivers.length, 'scoped_sao_paulo', scoped.length);
} finally {
  await prisma.$disconnect();
}

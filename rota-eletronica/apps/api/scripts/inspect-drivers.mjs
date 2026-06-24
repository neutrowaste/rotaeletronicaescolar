import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const count = await prisma.driver.count();
  const drivers = await prisma.driver.findMany({ take: 10, orderBy: { name: 'asc' } });
  const municipalities = await prisma.municipality.findMany({ select: { id: true, name: true }, take: 10 });
  console.log('driver_count', count);
  console.log('sample_drivers', JSON.stringify(drivers.map((d) => ({
    id: d.id,
    name: d.name,
    municipalityIds: d.municipalityIds,
    municipalityIdsType: typeof d.municipalityIds,
    isArray: Array.isArray(d.municipalityIds),
    status: d.status,
  })), null, 2));
  console.log('sample_municipalities', JSON.stringify(municipalities, null, 2));
} finally {
  await prisma.$disconnect();
}

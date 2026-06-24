/**
 * Remove IDs de município órfãos em Driver.municipality_ids e garante ao menos um ID válido.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((id) => typeof id === 'string' && id.trim());
  if (typeof raw === 'string') {
    try {
      return parseIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

try {
  const validIds = new Set(
    (await prisma.municipality.findMany({ select: { id: true } })).map((m) => m.id)
  );
  const fallbackId = [...validIds][0] ?? null;
  if (!fallbackId) {
    console.log('Nenhum município no banco — nada a corrigir.');
    process.exit(0);
  }

  const drivers = await prisma.driver.findMany();
  let updated = 0;
  for (const d of drivers) {
    let ids = parseIds(d.municipalityIds).filter((id) => validIds.has(id));
    if (ids.length === 0) {
      ids = [fallbackId];
    }
    const prev = JSON.stringify(parseIds(d.municipalityIds).sort());
    const next = JSON.stringify([...ids].sort());
    if (prev !== next) {
      await prisma.driver.update({
        where: { id: d.id },
        data: { municipalityIds: ids },
      });
      updated += 1;
      console.log('fixed', d.name, '->', ids.join(', '));
    }
  }
  console.log('drivers_checked', drivers.length, 'drivers_updated', updated);
} finally {
  await prisma.$disconnect();
}

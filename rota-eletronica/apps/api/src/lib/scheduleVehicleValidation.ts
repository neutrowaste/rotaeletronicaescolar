import { prisma } from './prisma.js';

export async function validateScheduleVehicleForRoute(
  routeId: string,
  vehicleId: string
): Promise<string | null> {
  const [route, vehicle] = await Promise.all([
    prisma.route.findUnique({ where: { id: routeId } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
  ]);

  if (!route) return 'Rota não encontrada no sistema.';
  if (!vehicle) return 'Veículo não encontrado no sistema.';
  if (vehicle.status !== 'active') {
    return 'Selecione um veículo ativo. Veículos em manutenção ou inativos não podem ser escalados.';
  }
  if (vehicle.municipalityId !== route.municipalityId) {
    return 'O veículo deve pertencer ao mesmo município da rota.';
  }
  if (route.garageId) {
    if (vehicle.garageId !== route.garageId) {
      return 'O veículo deve pertencer à garagem de origem definida na rota.';
    }
  }
  return null;
}

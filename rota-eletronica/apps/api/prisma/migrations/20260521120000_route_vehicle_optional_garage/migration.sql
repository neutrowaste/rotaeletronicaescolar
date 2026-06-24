-- Rota sem veículo fixo: veículo e motorista na escala; garagem de origem na roteirização.
ALTER TABLE "Route" DROP CONSTRAINT "Route_vehicle_id_fkey";

ALTER TABLE "Route" ALTER COLUMN "vehicle_id" DROP NOT NULL;

ALTER TABLE "Route" ADD CONSTRAINT "Route_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preenche garagem em rotas antigas a partir do veículo vinculado.
UPDATE "Route" AS r
SET "garage_id" = v."garage_id"
FROM "Vehicle" AS v
WHERE r."vehicle_id" = v."id"
  AND r."garage_id" IS NULL;

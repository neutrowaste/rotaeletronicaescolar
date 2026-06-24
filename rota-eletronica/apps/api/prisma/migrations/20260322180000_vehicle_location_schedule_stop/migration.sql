-- Localização do app do motorista + progresso na escala
ALTER TABLE "Vehicle" ADD COLUMN "last_location_at" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "last_location" JSONB;

ALTER TABLE "Schedule" ADD COLUMN "last_passed_stop_order" INTEGER NOT NULL DEFAULT 0;

-- Add transport type on vehicles
ALTER TABLE "Vehicle"
ADD COLUMN "transport_type" TEXT NOT NULL DEFAULT 'nao_informado';

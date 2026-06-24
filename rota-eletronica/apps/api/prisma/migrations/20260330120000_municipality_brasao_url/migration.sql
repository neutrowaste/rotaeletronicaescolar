-- Brasão por município (URL pública servida pelo front ou CDN)
ALTER TABLE "Municipality" ADD COLUMN IF NOT EXISTS "brasao_url" TEXT;

-- Pederneiras/SP (IBGE 3538006): arquivo estático em apps/web/public/brasoes/
UPDATE "Municipality"
SET "brasao_url" = '/brasoes/brasao-pederneiras.svg'
WHERE "ibge_code" = '3538006';

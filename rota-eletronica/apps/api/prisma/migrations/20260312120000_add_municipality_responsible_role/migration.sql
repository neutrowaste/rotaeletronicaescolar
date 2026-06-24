-- Cargo/Função do responsável (cadastro de município)
ALTER TABLE "Municipality" ADD COLUMN IF NOT EXISTS "responsible_role" TEXT;

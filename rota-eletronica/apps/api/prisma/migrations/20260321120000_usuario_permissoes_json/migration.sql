-- Permissões granulares (JSON) para perfis GESTOR e OPERADOR
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "permissoes" JSONB;

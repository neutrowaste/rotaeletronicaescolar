-- Foto de perfil do usuário do painel (persistência no PostgreSQL).
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "foto_perfil" TEXT;

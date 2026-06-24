-- Rastreia quem criou cada usuário do painel (escopo de edição para gestores).
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "criado_por_usuario_id" TEXT;
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_criado_por_usuario_id_fkey";
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_criado_por_usuario_id_fkey"
  FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "usuarios_criado_por_usuario_id_idx" ON "usuarios" ("criado_por_usuario_id");

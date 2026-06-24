-- CreateEnum
CREATE TYPE "UsuarioPerfil" AS ENUM ('GESTOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "UsuarioStatus" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "UsuarioSetor" AS ENUM ('SETOR_TRANSPORTE', 'SETOR_MAPAS', 'SETOR_EDUCACAO');

-- CreateEnum
CREATE TYPE "UsuarioAuditoriaAcao" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'RESET_SENHA', 'LOGIN');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "UsuarioPerfil" NOT NULL,
    "status" "UsuarioStatus" NOT NULL,
    "municipio_id" TEXT NOT NULL,
    "setor_unidade" "UsuarioSetor" NOT NULL,
    "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_acesso_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_auditoria" (
    "id" TEXT NOT NULL,
    "usuario_alvo_id" TEXT NOT NULL,
    "acao" "UsuarioAuditoriaAcao" NOT NULL,
    "ator_id" TEXT,
    "detalhes" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_login_key" ON "usuarios"("login");

-- CreateIndex
CREATE INDEX "usuario_auditoria_usuario_alvo_id_idx" ON "usuario_auditoria"("usuario_alvo_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_auditoria" ADD CONSTRAINT "usuario_auditoria_usuario_alvo_id_fkey" FOREIGN KEY ("usuario_alvo_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_auditoria" ADD CONSTRAINT "usuario_auditoria_ator_id_fkey" FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exige município quando há WebUser a migrar
DO $$
BEGIN
  IF (SELECT COUNT(*)::int FROM "WebUser") > 0 AND (SELECT COUNT(*)::int FROM "Municipality") = 0 THEN
    RAISE EXCEPTION 'Migração usuarios: cadastre ao menos um Município antes de migrar usuários WebUser existentes.';
  END IF;
END $$;

-- Migrate WebUser -> usuarios (preserva ids para Route.created_by)
INSERT INTO "usuarios" (
    "id",
    "nome_completo",
    "cpf",
    "email",
    "telefone",
    "login",
    "senha_hash",
    "perfil",
    "status",
    "municipio_id",
    "setor_unidade",
    "deve_trocar_senha",
    "ultimo_acesso_em",
    "criado_em",
    "atualizado_em"
)
SELECT
    w."id",
    w."name",
    LPAD((ROW_NUMBER() OVER (ORDER BY w."id"))::text, 11, '0'),
    lower(trim(w."email")),
    '-',
    split_part(lower(trim(w."email")), '@', 1) || '_' || substr(w."id", 1, 8),
    w."password_hash",
    CASE
        WHEN w."role" IN ('admin', 'gestor') THEN 'GESTOR'::"UsuarioPerfil"
        ELSE 'OPERADOR'::"UsuarioPerfil"
    END,
    'ATIVO'::"UsuarioStatus",
    COALESCE(
        (SELECT value FROM jsonb_array_elements_text(COALESCE(w."municipality_ids"::jsonb, '[]'::jsonb)) AS t(value) LIMIT 1),
        (SELECT "id" FROM "Municipality" LIMIT 1)
    ),
    'SETOR_TRANSPORTE'::"UsuarioSetor",
    false,
    NULL,
    w."created_at",
    w."updated_at"
FROM "WebUser" w;

-- Remove FK Route -> WebUser antes de dropar WebUser
ALTER TABLE "Route" DROP CONSTRAINT "Route_created_by_fkey";

-- DropTable WebUser
DROP TABLE "WebUser";

-- Recria FK Route -> usuarios
ALTER TABLE "Route" ADD CONSTRAINT "Route_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

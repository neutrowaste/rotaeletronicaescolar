-- CreateTable
CREATE TABLE "usuario_municipios" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "municipio_id" TEXT NOT NULL,

    CONSTRAINT "usuario_municipios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permissoes" (
    "perfil" "UsuarioPerfil" NOT NULL,
    "permissoes" JSONB,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_permissoes_pkey" PRIMARY KEY ("perfil")
);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "uf_atuacao" VARCHAR(2);

-- Backfill: uma linha em usuario_municipios por vínculo antigo
INSERT INTO "usuario_municipios" ("id", "usuario_id", "municipio_id")
SELECT substr(md5(random()::text || clock_timestamp()::text || u."id"), 1, 25), u."id", u."municipio_id"
FROM "usuarios" u
WHERE u."municipio_id" IS NOT NULL;

UPDATE "usuarios" u
SET "uf_atuacao" = m."state"
FROM "Municipality" m
WHERE u."municipio_id" IS NOT NULL AND u."municipio_id" = m."id";

-- Matriz por perfil (primeiro registro não nulo por perfil, senão null = acesso total)
INSERT INTO "perfil_permissoes" ("perfil", "permissoes", "atualizado_em")
VALUES
  ('GESTOR', (SELECT "permissoes" FROM "usuarios" WHERE "perfil" = 'GESTOR' AND "permissoes" IS NOT NULL ORDER BY "id" LIMIT 1), CURRENT_TIMESTAMP),
  ('OPERADOR', (SELECT "permissoes" FROM "usuarios" WHERE "perfil" = 'OPERADOR' AND "permissoes" IS NOT NULL ORDER BY "id" LIMIT 1), CURRENT_TIMESTAMP);

-- Remove colunas antigas de usuarios
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_municipio_id_fkey";
ALTER TABLE "usuarios" DROP COLUMN "municipio_id";
ALTER TABLE "usuarios" DROP COLUMN "permissoes";

-- AddForeignKey
ALTER TABLE "usuario_municipios" ADD CONSTRAINT "usuario_municipios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_municipios" ADD CONSTRAINT "usuario_municipios_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "usuario_municipios_usuario_id_municipio_id_key" ON "usuario_municipios"("usuario_id", "municipio_id");

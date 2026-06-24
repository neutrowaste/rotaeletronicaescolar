-- Permite município e setor em branco (perfil ADMIN); GESTOR/OPERADOR continuam obrigatórios na API.
ALTER TABLE "usuarios" ALTER COLUMN "municipio_id" DROP NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "setor_unidade" DROP NOT NULL;

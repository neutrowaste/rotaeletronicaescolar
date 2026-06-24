-- Conceder permissões ao usuário sist_urbandata no banco UrbanData.
-- Rode este script UMA VEZ conectado como postgres (ou outro superuser).
-- Exemplo (PowerShell, na pasta apps/api): psql -U postgres -d UrbanData -f prisma/grant-sist-urbandata.sql

-- Uso do schema public
GRANT USAGE ON SCHEMA public TO sist_urbandata;

-- Todas as tabelas existentes no schema public
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sist_urbandata;

-- Sequências (necessário para SERIAL / default cuid() etc.)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sist_urbandata;

-- Tabelas criadas no futuro (por este usuário que está rodando o script)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sist_urbandata;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sist_urbandata;

-- Opcional: tornar sist_urbandata dono das tabelas existentes (descomente se quiser owner total)
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I OWNER TO sist_urbandata', r.tablename);
--   END LOOP;
-- END $$;

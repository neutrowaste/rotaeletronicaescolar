# API — UrbanData Rota Eletrônica Escolar

Backend em Node.js (Fastify + Prisma) que persiste dados no **PostgreSQL**. Utiliza o database **UrbanData** já existente no PostgreSQL local (não cria outro database).

## Pré-requisitos

- Node.js 18+
- PostgreSQL com o database **UrbanData** criado (Servers → PostgreSQL 18 → Databases → UrbanData)

## Configuração

1. Copie o arquivo de exemplo e preencha com suas credenciais locais:
   ```bash
   cp .env.example .env
   ```
2. Edite `.env` e ajuste:
   - **DATABASE_URL**: usuário e senha do PostgreSQL. Exemplo: `postgresql://postgres:SUA_SENHA@localhost:5432/UrbanData`
   - **JWT_SECRET**: chave secreta para tokens JWT (mínimo 32 caracteres em produção)
   - **PORT**: porta da API (padrão 3001)
   - **AT_REST_ENCRYPTION_KEY** (opcional): frase secreta longa (≥16 caracteres) para cifrar a foto de perfil dos usuários no banco (AES-256-GCM). Senhas de login usam **bcrypt** (hash irreversível), independentemente desta chave.

## Primeira execução

1. Aplicar as migrations no database UrbanData:
   ```bash
   npm run db:migrate
   ```
   (Ou `npm run db:migrate:dev` para criar novas migrations em desenvolvimento.)

2. (Opcional) Criar usuários de referência **ADMIN**, **GESTOR** e **OPERADOR** no banco:
   ```bash
   npm run db:seed-usuarios
   ```
   Requer ao menos um município cadastrado. Senha inicial comum: **UrbanData2025!** (logins: `admin`, `gestor`, `operador`).

   O `npm run db:seed` não cria usuários; com a tabela vazia, use a tela **Primeiro acesso** no web ou `POST /api/auth/bootstrap`.

3. Iniciar a API:
   ```bash
   npm run dev
   ```
   A API ficará disponível em `http://localhost:3001`.

## Endpoints principais

- `POST /api/auth/login` — Login (email + senha); retorna `token` e `user` (incl. `photo` quando houver foto salva).
- `GET /api/auth/me` — Dados atuais do usuário logado (sincroniza com o PostgreSQL).
- `PATCH /api/auth/me` — Corpo JSON: `fotoPerfil` (string data URL, `null` para remover) e/ou `senhaAtual` + `novaSenha` + `confirmarNovaSenha` para trocar a senha (hash bcrypt no banco).
- `GET/POST/PATCH/DELETE /api/municipalities` — CRUD municípios.
- `GET/POST/PATCH/DELETE /api/schools` — CRUD escolas.
- `GET/POST/PATCH/DELETE /api/garages` — CRUD garagens.
- `GET/POST/PATCH/DELETE /api/vehicles` — CRUD veículos.
- `GET/POST/PATCH/DELETE /api/drivers` — CRUD motoristas.
- `GET/POST/PATCH/DELETE /api/students` — CRUD alunos.
- `GET/POST/PATCH/DELETE /api/routes` — CRUD rotas.
- `GET/POST/PATCH/DELETE /api/schedules` — CRUD escalas.
- `GET /api/health` — Health check.

As rotas de dados aceitam o header `Authorization: Bearer <token>` (após login). O frontend envia o token automaticamente.

## `npm run db:generate` e erro EPERM (Windows)

O cliente Prisma é gerado em **`apps/api/node_modules/.prisma/api-client`** (não na raiz do monorepo), para evitar conflito com outros processos Node.

Se ainda aparecer **EPERM** ao renomear `query_engine-windows.dll.node`, **pare a API** (`Ctrl+C` no terminal do `npm run dev`) e rode de novo `npm run db:generate`.

Se a migration adicionou um valor de enum (ex.: `ADMIN` em `UsuarioPerfil`) mas o **binário do query engine** não foi atualizado, o login podia falhar com **500** e mensagem do tipo `Value 'ADMIN' not found in enum 'UsuarioPerfil'`. A rota `POST /auth/login` usa leitura em SQL bruto para contornar isso; mesmo assim, **rode `npm run db:generate`** com a API parada para alinhar o client.

## Onde está a UrbanData

- **Database**: nome do database no PostgreSQL local = **UrbanData**.
- **Conexão**: configurada em `DATABASE_URL` no `.env` (host, porta, usuário, senha e nome do database).
- As tabelas são criadas **dentro** desse database pelas migrations em `prisma/migrations/`.

## Testes automatizados (qualidade)

Com **PostgreSQL** acessível (`DATABASE_URL` no `.env`):

```bash
npm run test
```

- **Health** (`GET /api/health`)
- **Auth** (`POST /api/auth/login`: validações 400/401; login admin 200 se existir seed)
- **Rotas** (`POST/GET/PATCH/DELETE /api/routes`): cria dados de teste (município, garagem, escola, veículo), valida criação de rota, listagem com filtro, atualização e exclusão; limpa o banco ao final.

Para acompanhar em modo watch:

```bash
npm run test:watch
```

**Nota:** Se `npm install` falhar com **EPERM** no `prisma generate`, use `npm install --ignore-scripts` e, com a API parada, rode `npm run db:generate`.

## Testar persistência (manual)

1. Subir a API (`npm run dev` no `apps/api`).
2. Subir o frontend (`npm run dev:web` na raiz do monorepo).
3. No frontend, configurar `VITE_API_URL=http://localhost:3001` no `.env` do `apps/web` (ou usar o padrão).
4. Fazer login com **admin@urbandata.com** / **admin123** (após `npm run db:seed`).
5. **Fluxo recomendado para salvar rotas pela API:** cadastrar **município, garagem, escola e veículo** pelo sistema (dados vêm do banco). Depois criar a rota — os IDs precisam existir no PostgreSQL.
6. Verificar no banco (pgAdmin ou `npm run db:studio` no `apps/api`).
7. Rodar `npm run test` para validar que os endpoints continuam corretos.

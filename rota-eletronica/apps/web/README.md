# UrbanData — Sistema Web (Rota Eletrônica Escolar)

App React + Vite + TypeScript + Tailwind. Tema UrbanData (verde, azul petróleo, fundo escuro). Os dados são persistidos no **PostgreSQL** (database UrbanData) via API em `apps/api`.

## Pré-requisitos

- **API**: subir a API antes (ou em outro terminal). Ver `apps/api/README.md`.
- Na raiz do monorepo, buildar os pacotes antes de rodar o web:
  ```bash
  npm run build:packages
  npm install
  ```

## Configuração

- Crie `apps/web/.env` a partir de `.env.example`.
- **VITE_API_URL**: URL da API (padrão `http://localhost:3001`). Use se a API rodar em outro host/porta.

## Desenvolvimento

1. Subir a API (em `apps/api`): `npm run dev` (e aplicar migrations + seed; ver `apps/api/README.md`).
2. Na raiz do monorepo:
   ```bash
   npm run dev:web
   ```
   Ou dentro de `apps/web`: `npm run dev`.

Abre em: **http://localhost:5173**

## Login

Com os usuários de sistema criados no banco (`apps/api`: `npm run db:seed-usuarios`), use por exemplo:

| Login    | Senha             | Perfil        |
|----------|-------------------|---------------|
| `admin`  | `UrbanData2025!`  | Administrador |
| `gestor` | `UrbanData2025!`  | Gestor        |
| `operador` | `UrbanData2025!` | Operador     |

Se a tabela `usuarios` estiver vazia, use a tela **Primeiro acesso** no login ou `POST /api/auth/bootstrap`.

O token é enviado à API e armazenado no `localStorage`; as requisições usam `Authorization: Bearer <token>`.

## Performance dos dados

Após o login, o **Layout** carrega **em paralelo** todas as listas da API (municípios, escolas, veículos, rotas, etc.) **uma única vez**, com tela de “Carregando dados do sistema…”. Assim:

- Ao **mudar de página** (SPA), os dados já estão na memória — **listas e combos aparecem na hora**.
- Ao **gravar** (criar/editar/excluir), os stores são atualizados na resposta da API — o novo registro **já entra na lista** sem precisar recarregar a página.
- Use o botão **Atualizar** (ícone de refresh) na barra superior para **sincronizar de novo** com o banco (outra aba ou outro usuário).

## Build

Na raiz:

```bash
npm.cmd run build:web
```

Saída em `apps/web/dist`.

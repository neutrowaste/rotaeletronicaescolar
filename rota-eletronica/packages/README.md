# Packages — Base do monorepo

## Estrutura

- **shared-types** — Interfaces TypeScript compartilhadas (Municipality, School, Vehicle, Driver, Student, Route, Schedule, Incident, etc.).
- **shared-utils** — Máscaras (CPF, telefone, placa, CEP), validadores (CPF, e-mail, senha) e formatadores (data, hora, duração, km).
- **shared-mocks** — Dados mock: 12 municípios, 20 escolas, 40 veículos, 15 motoristas, 200 alunos, 30 rotas, 20 escalas, 10 intercorrências, 15 usuários pais e usuários web (admin, operador, gestor).

## Build (na raiz do monorepo)

```bash
npm install
npm run build:packages
```

Ordem do build: `shared-types` → `shared-utils` → `shared-mocks`.

## Uso nos apps

- **apps/web**: `import { municipalities, routes } from '@rota-eletronica/shared-mocks'` e `import type { Student } from '@rota-eletronica/shared-types'`.
- **apps/mobile-***: idem, usando os mesmos pacotes.

Credenciais mock do sistema web: `admin@urbandata.com` / `admin123`, `operador@urbandata.com` / `op456`, `gestor@urbandata.com` / `gest789`.  
App pais: `pai@email.com` / `pai123`. App motorista: `motorista@email.com` / `mot123`.

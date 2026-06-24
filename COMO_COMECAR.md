# Como começar o desenvolvimento — UrbanData Rota Eletrônica Escolar

Este guia resume o prompt técnico do documento Word e sugere a ordem de implementação.

---

## 1. Resumo do que será construído

- **Sistema Web** (React + TypeScript + Vite + Tailwind): painel administrativo (login, dashboard, mapa, roteirização com otimizador Google Routes, veículos, alunos, municípios, escolas).
- **App Pais** (React Native + Expo): login, dados do aluno, itinerário em tempo real (mapa com ônibus mock).
- **App Motorista** (React Native + Expo): login, seleção de veículo/rota, rota ativa, reconhecimento facial (mock) no embarque, intercorrências, finalização de rota.

**APIs reais:** apenas Google Maps (Maps, Directions, Geocoding, Places, Routes) e ViaCEP.  
**Dados:** todos mockados em `packages/shared-mocks`, tipados com `packages/shared-types`.

---

## 2. Ordem sugerida de desenvolvimento

### Fase 1 — Base do monorepo e tipos

1. **Estrutura do monorepo** (já iniciada em `rota-eletronica/`):
   - `package.json` raiz com workspaces: `apps/*` e `packages/*`.
   - `packages/shared-types`: interfaces TypeScript (Municipality, School, Vehicle, Driver, Student, Route, Schedule, Incident, etc.).
2. **Packages compartilhados:**
   - Finalizar `shared-types` (já criado) e buildar (`npm run build` dentro do package).
   - Criar `packages/shared-mocks`: dados mock (municipalities, schools, vehicles, drivers, students, routes, schedules, incidents, parentUsers) conforme o documento.
   - Criar `packages/shared-utils`: formatadores, máscaras (CPF, placa, telefone), validadores reutilizáveis.

### Fase 2 — Sistema Web (prioridade para demonstração)

3. **App Web (Vite + React + Tailwind):**
   - Configurar Vite, React, TypeScript, Tailwind, tema UrbanData (cores, Poppins, border-radius 12px).
   - Copiar/uso da logo em `assets` (ex.: do `Logo UrbanData.svg` na pasta do projeto).
4. **Autenticação e layout:**
   - Login mock (admin@urbandata.com / admin123, etc.), token no `localStorage`, redirecionamento para `/dashboard`.
   - Rotas protegidas (redirect para `/login` se não autenticado).
   - Layout: sidebar colapsável (64px / 240px), topbar com título, breadcrumb, notificações mock, avatar + dropdown.
5. **Dashboard (Home):**
   - 4 KPIs (alunos, veículos ativos, rotas ativas hoje, municípios).
   - Gráficos Recharts (alunos por município, rotas nos últimos 7 dias).
   - Tabela resumo das últimas 5 rotas e mapa miniatura com pins das escolas.
6. **Mapa:**
   - Google Maps fullscreen, busca com Places Autocomplete, painel de filtros (município, rota, turno, escola).
   - Marcadores (paradas, veículos, escolas), polylines, InfoWindow ao clicar.
7. **Roteirização (núcleo):**
   - Listagem de rotas com filtros e paginação.
   - Criação de rota: dados básicos, adição de paradas (endereço / clique no mapa / aluno), lista com drag-and-drop (@dnd-kit).
   - Botão **Otimizar Rota** → chamada Google Routes API (Waypoint Optimization), atualizar ordem de paradas e polyline.
   - Pré-visualização da rota e “Salvar” (persistir no store Zustand).
   - Associar rota à escala (modal) e visualização de escalas (calendário/cards).
8. **Cadastros:** Veículos, Alunos (com ViaCEP e Places para pontos), Municípios, Escolas — listagens + formulários com validação (react-hook-form + zod).

### Fase 3 — Apps mobile

9. **App Pais (Expo):**
   - Auth (login, criar conta em 3 passos com vínculo por matrícula), recuperação de senha mock.
   - Navegação drawer: Dados do Aluno, Itinerário em Tempo Real, Sair.
   - Tela de dados do aluno (read-only); itinerário com mapa, posição mock do ônibus (setInterval na polyline), bottom sheet de status, modal de intercorrência.
10. **App Motorista (Expo):**
    - Auth + primeiro acesso (CPF mock).
    - Fluxo pós-login: seleção de veículo → seleção de rota → pré-visualização → Iniciar Rota.
    - Tela de rota ativa: mapa, parada atual, lista de alunos com botão “Registrar embarque” (reconhecimento facial mock com níveis de confiança e confirmação manual).
    - Desembarque, finalização de rota (resumo), registro de intercorrência (FAB).

### Fase 4 — Integração e polish

11. **Estado e “sincronização” mock:**
    - Zustand no web; no mobile, Zustand ou Context.
    - Simulação de movimento do ônibus (posição interpolada na polyline) e de intercorrência (motorista registra → app pais exibe modal).
12. **Google Maps:**
    - Roteirizador no web: `routingEngine.ts` com Routes API (optimizeWaypointOrder), decodificação de polyline, desenho no mapa com setas.
    - Garantir mesma API Key (e restrições) para web e mobile.

---

## 3. Onde está o que já foi criado

- **`rota-eletronica/`**
  - `package.json` raiz (workspaces).
  - `packages/shared-types/`: `package.json`, `tsconfig.json`, `src/index.ts` com as interfaces do documento.

Próximos passos imediatos:

1. Rodar `npm install` na raiz de `rota-eletronica`.
2. Buildar `shared-types`: `npm run build -w @rota-eletronica/shared-types` (ou entrando em `packages/shared-types` e `npm run build`).
3. Criar `packages/shared-mocks` com os 12 municípios e depois escolas, veículos, motoristas, alunos, rotas, escalas, intercorrências e usuários pais.
4. Criar o app web com Vite (`apps/web`) e implementar login + layout + dashboard.

---

## 4. Referência rápida

- **Cores UrbanData:** primária `#20B573`, fundo `#001B28`, azul petróleo `#1C727A`, texto `#D0D0D0`.
- **Fonte:** Poppins (Google Fonts).
- **Ícones:** Lucide React (web), Lucide React Native (mobile).
- **Google Maps API Key (documento):** usar com restrições de uso e não commitar em repositório público; preferir variável de ambiente.

Se quiser, o próximo passo pode ser: (1) criar o conteúdo completo de `shared-mocks` (municipalities + schools + …) ou (2) scaffold do `apps/web` (Vite + React + Tailwind + rota de login e dashboard).

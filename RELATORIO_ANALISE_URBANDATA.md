# Relatório de Análise – UrbanData (Rota Eletrônica Escolar)

## 1. Problema de endereços que somem

### Conclusão: causa provável

**Causa raiz:** Nos formulários de **edição** (StudentEdit, GarageEdit, SchoolEdit), os campos de endereço (rua, bairro, número, CEP) **não são preenchidos** a partir do dado já salvo (`address`). Na submissão, o frontend chama `buildAddress()`, que usa apenas o estado atual desses campos. Como eles continuam vazios, o valor enviado é `"-"` ou só "Município, UF", **sobrescrevendo** o endereço correto no banco.

- **API:** retorna e persiste `address` corretamente (GET e mapToApi incluem o campo; POST/PATCH usam `toDb` com `address`).
- **Banco:** Prisma persiste o campo `address` (String) em School, Garage e Student.
- **Frontend no POST/Create:** envia `address: buildAddress()` com campos preenchidos pelo usuário — OK.
- **Frontend no PATCH/Edit:** envia `address: buildAddress()` com **rua/bairro/numero/cep vazios** (nunca preenchidos a partir do registro existente), então o valor salvo é perdido/substituído por "-" ou endereço incompleto.

Ou seja: o bug é **frontend não envia o endereço correto no PATCH** porque o formulário de edição não inicializa os campos de endereço a partir do `address` já existente.

---

### Evidências por entidade

#### Alunos (students)

| Onde | Arquivo | Comportamento |
|------|---------|----------------|
| API GET | `apps/api/src/routes/students.ts` | `findMany`/`findUnique` sem `include`; resposta via `mapToApi.toStudent(row)`, que inclui `address`, `boardingPoint`, `alightingPoint`. |
| API POST/PATCH | `apps/api/src/routes/students.ts` | `toDb()` usa `body.address`; no PATCH faz `toDb({ ...row, ...request.body })`, então o que vier no body sobrescreve. |
| mapToApi | `apps/api/src/lib/mapToApi.ts` (linhas 110–130) | `toStudent` retorna `address: m.address`, `boardingPoint`, `alightingPoint`. |
| Frontend edit | `apps/web/src/pages/students/StudentEdit.tsx` | **useEffect (125–151):** preenche name, registrationNumber, schoolId, municipalityId, addressLat/addressLng (de `boardingPoint`), etc. **Não preenche** `rua`, `bairro`, `numero`, `cep` a partir de `student.address`. **handleSubmit (222):** envia `address: buildAddress()` (rua/numero/bairro vazios → resultado "-" ou incompleto). |

Trecho relevante – inicialização do form (não há setRua/setBairro/setNumero/setCep a partir de `student.address`):

```125:151:rota-eletronica/apps/web/src/pages/students/StudentEdit.tsx
  useEffect(() => {
    if (!student) return;
    setName(student.name);
    // ... municipalityId, schoolId, state, addressLat, addressLng, etc.
    setRespName(student.responsible?.name ?? '');
    // ...
  }, [student?.id, municipalitiesList]);
```

E no submit:

```222:223:rota-eletronica/apps/web/src/pages/students/StudentEdit.tsx
      address: buildAddress(),
```

---

#### Garagem (garage)

| Onde | Arquivo | Comportamento |
|------|---------|----------------|
| API | `apps/api/src/routes/garages.ts` | GET retorna `address` via `mapToApi.toGarage`; POST/PATCH usam `toDb(body)` com `address`. |
| Frontend edit | `apps/web/src/pages/garages/GarageEdit.tsx` | **useEffect (38–46):** só preenche `name`, `municipalityId`, `state`, `lat`, `lng`. **Não preenche** `rua`, `bairro`, `numero`, `cep` a partir de `garage.address`. **handleSubmit (81):** `address: buildAddress()` → com campos vazios vira "-" ou só "Município, UF". |

Trecho relevante:

```38:46:rota-eletronica/apps/web/src/pages/garages/GarageEdit.tsx
  useEffect(() => {
    if (!garage) return;
    setName(garage.name);
    setMunicipalityId(garage.municipalityId);
    const mun = municipalitiesList.find((m) => m.id === garage.municipalityId);
    if (mun) setState(mun.state);
    setLat(String(garage.coordinates.lat));
    setLng(String(garage.coordinates.lng));
  }, [garage?.id, garage?.municipalityId, municipalitiesList]);
```

Nenhum `setRua`, `setBairro`, `setNumero`, `setCep` a partir de `garage.address`.

---

#### Escola (school)

| Onde | Arquivo | Comportamento |
|------|---------|----------------|
| API | `apps/api/src/routes/schools.ts` | GET retorna `address`; POST/PATCH usam `toDb` com `address`. |
| Frontend edit | `apps/web/src/pages/schools/SchoolEdit.tsx` | **useEffect (48–59):** preenche name, municipalityId, state, phone, principal, status, lat, lng. **Não preenche** `rua`, `bairro`, `numero`, `cep` a partir de `school.address`. **handleSubmit (121):** `address: buildAddress()` → mesmo problema. |

Trecho relevante:

```48:59:rota-eletronica/apps/web/src/pages/schools/SchoolEdit.tsx
  useEffect(() => {
    if (!school) return;
    setName(school.name);
    setMunicipalityId(school.municipalityId);
    // ...
    setLat(String(school.coordinates.lat));
    setLng(String(school.coordinates.lng));
  }, [school?.id, school?.municipalityId, municipalitiesList]);
```

---

### Sugestão de correção (sem aplicar mudanças)

1. **Opção A – Preencher campos no edit**  
   Nos três formulários (StudentEdit, GarageEdit, SchoolEdit), no `useEffect` que inicializa o form a partir do registro:
   - Ou exibir `address` em um único campo somente leitura e, no submit, enviar `address: student.address` (ou `garage.address` / `school.address`) quando o usuário não alterar endereço.
   - Ou “quebrar” o `address` salvo em partes (rua, bairro, número) para preencher os inputs — lembrando que parsing de endereço em string é frágil; se o formato for estável (ex.: "Rua X, 123, Bairro, Município, UF"), dá para fazer um parse simples e preencher rua, numero, bairro (e CEP se existir em outro campo ou no mesmo padrão).

2. **Opção B – Não sobrescrever se vazio**  
   No submit do edit: se `buildAddress()` resultar em `"-"` ou string vazia/inválida, enviar o valor já existente (ex.: `address: buildAddress() || student.address` em StudentEdit, e equivalente para garage/school).

3. **Opção C – Campo único no edit**  
   Na tela de edição, usar um único input para endereço pré-preenchido com `student.address` / `garage.address` / `school.address`, e enviar esse valor no PATCH em vez de depender de rua/bairro/numero no buildAddress.

Recomendação prática: **Opção B** como correção rápida (evita apagar o que já está salvo); **Opção A ou C** para uma solução mais consistente de UX (form preenchido ou campo único).

---

## 2. Performance geral

### 2.1 Queries e listagens

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| Listagens sem paginação | `apps/api/src/routes/students.ts`, `schools.ts`, `garages.ts`, `vehicles.ts`, `drivers.ts`, `routes.ts` | `findMany` sem `take`/`skip` retorna todos os registros. Em município com muitos alunos/rotas, o payload e o tempo de resposta crescem muito. | Adicionar parâmetros de query `page` e `pageSize` (ou `limit`/`offset`) e usar `take`/`skip` no Prisma. Retornar metadados de paginação (total, page) no JSON. |
| GET /students e GET /routes | `apps/api/src/routes/students.ts`, `routes.ts` | Resposta inclui todos os alunos (com address, boardingPoint, alightingPoint) ou todas as rotas (com stops, polyline). Payload pode ficar grande. | Além de paginação, considerar listagem “resumida” (ex.: só id, name, schoolId para alunos) e endpoint de detalhe completo por ID. |
| Schedules com include | `apps/api/src/routes/schedules.ts` | `findMany`/`findUnique` com `include: { incidents: true }` está adequado para evitar N+1 em incidents. | Manter; não há N+1 aqui. |

### 2.2 Índices no banco

| Item | Arquivo | Descrição | Sugestão |
|------|---------|-----------|----------|
| Sem índices explícitos | `apps/api/prisma/schema.prisma` | Nenhum `@@index` nos modelos. Filtros por `municipalityId`, `schoolId`, `garageId`, `routeId` etc. podem fazer full table scan em tabelas grandes. | Adicionar índices compostos onde fizer sentido, por exemplo: `Student`: `@@index([municipalityId])`, `@@index([schoolId])`, `@@index([routeId])`; `Route`: `@@index([municipalityId])`; `Vehicle`/`Garage`/`School`: `@@index([municipalityId])`. Revisar outros filtros usados nas rotas e criar índices alinhados a eles. |

### 2.3 Cache

| Item | Onde | Descrição | Sugestão |
|------|------|-----------|----------|
| Sem cache HTTP | API | Nenhum header `Cache-Control` ou camada de cache para listagens (municipalities, schools, garages). | Para dados pouco voláteis (ex.: lista de municípios), considerar `Cache-Control: private, max-age=60` ou cache em memória (ex.: TTL por rota). |
| Frontend | Stores Zustand | Dados são recarregados via bootstrap; não há revalidação por tempo nem cache por recurso. | Opcional: cache com TTL ou “stale-while-revalidate” para listas, evitando refetch desnecessário em toda navegação. |

### 2.4 Outros pontos de performance

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| Geocode no frontend | StudentCreate, StudentEdit, GarageEdit, SchoolEdit | Chamadas a serviço de geocode (CEP, endereço) podem ser lentas e bloqueiam a UI. | Debounce nos campos que disparam geocode; indicador de loading; considerar geocode opcional ou em background. |
| Bootstrap carrega tudo | `apps/web/src/services/appBootstrap.ts` | `bootstrapAllAppData()` carrega todas as listas de uma vez. Em cenários com muitos dados, o tempo inicial pode ser alto. | Carregar por demanda (ex.: só municipalities + schools ao abrir; students/routes quando acessar a área correspondente) ou manter bootstrap mas com paginação nas APIs para reduzir tamanho da primeira resposta. |

---

## 3. Outros pontos de correção

### 3.1 Validações

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| Body sem validação estruturada | `students.ts`, `garages.ts`, `schools.ts`, `vehicles.ts`, `drivers.ts` | Uso de `body.field as string` em `toDb()` sem checagem de tipo ou presença. Dados inválidos podem gerar erros 500 ou valores estranhos no banco. | Introduzir validação (ex.: Zod) nos bodies de POST/PATCH: schema por recurso, mensagens de erro claras e retorno 400 com lista de erros. |
| Campos obrigatórios | Ex.: `apps/api/src/routes/students.ts` (toDb) | `address`, `schoolId`, `boardingPoint`, `alightingPoint` são usados como obrigatórios no create, mas não há validação explícita antes do create. | Validar obrigatoriedade e formato (ex.: coordinates com lat/lng) e retornar 400 com mensagem específica antes de chamar Prisma. |
| Escolas | `apps/api/src/routes/schools.ts` | Não há validação de `coordinates` (objeto com lat/lng) nem de tamanho de strings. | Validar formato de coordinates e tamanhos máximos (nome, address, etc.) para evitar dados inválidos. |

### 3.2 Tratamento de erros

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| PATCH sem try/catch | `students.ts`, `garages.ts`, `schools.ts` | POST/PATCH não estão dentro de try/catch. Falha do Prisma (ex.: P2003, P2002) resulta em 500 genérico. | Envolver create/update em try/catch; mapear códigos Prisma (P2003 foreign key, P2002 unique) para 400 com mensagem amigável; 500 apenas para erros inesperados. |
| DELETE engole erro | `students.ts` (linha 56), `garages.ts`, `schools.ts` | `prisma.student.delete(...).catch(() => null)` ignora o erro e sempre retorna 204. Cliente não sabe se realmente excluiu ou se falhou (ex.: constraint). | Não usar `.catch(() => null)`; tratar exceção e retornar 404 se registro não existir ou 409/400 se houver restrição (ex.: aluno em rota). |
| Consistência de resposta de erro | Várias rotas | Algumas rotas retornam `{ error: string }`, outras podem deixar o Fastify enviar resposta padrão. | Padronizar formato de erro (ex.: `{ error: string, code?: string }`) e usar um hook/setErrorHandler no Fastify para respostas 4xx/5xx. |

### 3.3 Inconsistências front/back

| Item | Onde | Descrição | Sugestão |
|------|------|-----------|----------|
| Detalhe/Edição sem fetch por ID | StudentDetail, StudentEdit, GarageEdit, SchoolEdit | Páginas usam apenas o store (getStudentById, getGarageById, getSchoolById). Se o usuário acessar a URL direta (ex.: /alunos/editar/:id) sem ter passado pela listagem, o store pode estar vazio e a tela mostra “não encontrado”. | Na rota de detalhe/edição, se o registro não estiver no store, chamar `api.students.get(id)` (ou equivalente) e popular o store ou o estado local antes de renderizar o form. |
| Tipo de retorno da API | `apps/web/src/services/api.ts` | Vários métodos usam `api.get<unknown[]>`; o front depende de tipagem implícita ao atribuir a stores. | Usar tipos de `shared-types` (Student, School, Garage, etc.) nos métodos da API (ex.: `api.get<Student[]>(...)`) para garantir consistência e evitar erros em tempo de desenvolvimento. |

### 3.4 Segurança e boas práticas

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| Token no localStorage | `apps/web/src/services/api.ts` | Token JWT em localStorage pode ser acessado por scripts (XSS). | Avaliar uso de cookies httpOnly para refresh token e manter access token em memória quando possível; ou manter localStorage com mitigação de XSS (CSP, sanitização). |
| Log de body em erro | `apps/api/src/routes/routes.ts` (POST/PATCH) | Em falha, loga `request.body` que pode conter dados sensíveis. | Evitar logar body completo em produção; logar apenas IDs ou campos não sensíveis. |

### 3.5 Dados e modelo

| Item | Arquivo(s) | Descrição | Sugestão |
|------|------------|-----------|----------|
| School.totalStudents no update | `apps/api/src/routes/schools.ts` (toDb) | `toDb` aceita `totalStudents` do body e grava. Permite que o frontend altere esse contador manualmente. | Tratar totalStudents como dado derivado: calcular no backend a partir da contagem de alunos (Student) por schoolId e não aceitar no PATCH; ou manter mas documentar que é “manual” e considerar um job que recalcule. |
| Coordenadas opcionais | Prisma: School, Garage têm `coordinates Json` não opcional; Municipality tem `coordinates Json?` | Inconsistência de obrigatoriedade. Se no front coordinates podem vir vazias, o create pode falhar. | Alinhar: ou tornar coordinates opcional em School/Garage e tratar null no mapToApi, ou garantir que o front sempre envie um objeto { lat, lng } (e validar na API). |

---

## 4. Resumo das ações sugeridas

| Prioridade | Área | Ação |
|------------|------|------|
| Alta | Endereços | Corrigir formulários de edição (Student, Garage, School) para não sobrescrever `address` com "-" (preencher campos a partir do address existente ou enviar o address atual quando buildAddress() for vazio). |
| Alta | Erro | Tratar erros de Prisma em PATCH/POST e DELETE (try/catch, 400/404/409) e padronizar formato de erro. |
| Média | Performance | Paginação em listagens (students, routes, etc.) e índices no schema Prisma para filtros mais usados. |
| Média | Validação | Validação de body (Zod ou similar) em POST/PATCH para alunos, escolas, garagens. |
| Média | Frontend | Garantir carregamento por ID na tela de detalhe/edição quando o registro não estiver no store. |
| Baixa | Performance | Cache HTTP ou em memória para listagens pouco voláteis; carregamento sob demanda no bootstrap. |
| Baixa | Consistência | Tipagem forte nos métodos do cliente API; totalStudents e coordinates alinhados entre front e back. |

---

*Relatório gerado com base na análise do código do monorepo `rota-eletronica` (apps/api e apps/web). Nenhuma alteração foi aplicada ao código; todas as sugestões são apenas recomendadas.*

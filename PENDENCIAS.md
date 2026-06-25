# 📌 Lista de Pendências — Rota Eletrônica Escolar

Este arquivo documenta as tarefas técnicas e de infraestrutura pendentes que precisam ser realizadas no projeto.

---

## 🛠️ Pendências de Infraestrutura e Segurança

### 1. Restrição de Segurança da API Key do Google Maps
* **Contexto:** Durante o build do frontend, o Docker emite avisos (`SecretsUsedInArgOrEnv`) sobre passar a `VITE_GOOGLE_MAPS_API_KEY` via `ARG`/`ENV`. Como o frontend React roda no navegador, a chave é inerentemente pública.
* **Ação Necessária:**
  1. Acessar o **Google Cloud Console** > *APIs e Serviços* > *Credenciais*.
  2. Editar a chave de API utilizada para o Google Maps.
  3. Em **Restrições de aplicativo**, selecionar **Sites (referenciadores HTTP)**.
  4. Adicionar os domínios autorizados para o projeto:
     * `https://*.urbandata.com.br/*`
     * `https://*.neutrowaste.cloud/*`
     * `http://localhost:5173/*` (para testes locais, se necessário)
  5. Em **Restrições de API**, permitir o uso da chave apenas para as APIs necessárias (*Maps JavaScript API*, *Geocoding API*, *Directions API*, *Routes API*).

### 2. Correção do Host do Banco de Dados PostgreSQL no Easypanel
* **Contexto:** A API em homologação/produção apresentou erro de inicialização `PrismaClientInitializationError: Can't reach database server at neutro_aplicacoes_clientes:5432`. O uso de sublinhado (`_`) viola especificações de DNS e o resolvedor do Docker/Easypanel provavelmente higienizou o host usando hifens.
* **Ação Necessária:**
  1. Acessar o painel administrativo do **Easypanel**.
  2. Selecionar o serviço do **Backend/API**.
  3. Alterar o valor da variável de ambiente **`DATABASE_URL`** substituindo o host com sublinhado pelo host correto com hífen:
     * *De:* `postgresql://postgres:senha@neutro_aplicacoes_clientes:5432/UrbanData`
     * *Para:* `postgresql://postgres:senha@neutro-aplicacoes-clientes:5432/UrbanData`
  4. Salvar e fazer o **Redeploy** da API.

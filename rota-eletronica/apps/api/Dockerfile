# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copia arquivos de definição do monorepo para cache de dependências
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json
COPY packages/shared-mocks/package.json packages/shared-mocks/package.json
COPY apps/api/package.json apps/api/package.json

# Instala todas as dependências (incluindo as de dev necessárias para build)
RUN npm ci

# Copia códigos fontes necessários
COPY packages/shared-types packages/shared-types
COPY packages/shared-utils packages/shared-utils
COPY packages/shared-mocks packages/shared-mocks
COPY apps/api apps/api

# Builda os pacotes locais compartilhados
RUN npm run build -w @rota-eletronica/shared-types
RUN npm run build -w @rota-eletronica/shared-utils
RUN npm run build -w @rota-eletronica/shared-mocks

# Gera o cliente Prisma e compila a API
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Run
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia pacotes necessários
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

# Copia node_modules construído (para evitar reinstalar no run que pode quebrar com symlinks locais)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist

# Copia build da API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3001

WORKDIR /app/apps/api

# Inicia a API
CMD ["node", "dist/index.js"]

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copia arquivos de definição do monorepo para cache de dependências
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json
COPY packages/shared-mocks/package.json packages/shared-mocks/package.json
COPY apps/web/package.json apps/web/package.json

# Instala todas as dependências ignorando scripts automáticos
RUN npm ci --ignore-scripts

# Copia códigos fontes necessários
COPY packages/shared-types packages/shared-types
COPY packages/shared-utils packages/shared-utils
COPY packages/shared-mocks packages/shared-mocks
COPY apps/web apps/web

# Builda os pacotes locais compartilhados
RUN npm run build -w @rota-eletronica/shared-types
RUN npm run build -w @rota-eletronica/shared-utils
RUN npm run build -w @rota-eletronica/shared-mocks

# Argumentos de build passados na construção (Vite consome no build-time)
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Compila a aplicação Frontend
WORKDIR /app/apps/web
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copia configuração customizada do Nginx
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copia arquivos compilados do builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

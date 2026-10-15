# syntax=docker/dockerfile:1

# API de produção. Alvos: "runtime" (a API, o padrão) e "migrate" (aplica as
# migrations e sai). Construir com --pull de tempos em tempos para receber as
# correções de segurança da imagem base.
FROM node:24-bookworm-slim AS base
WORKDIR /app
# O motor de consultas do Prisma precisa do OpenSSL, que a imagem slim não traz.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN node_modules/.bin/prisma generate
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Os binários do Prisma para migrar vêm do postinstall, que a imagem final não
# roda (ver prod-deps); por isso as migrations rodam nesta imagem, que sai
# quando termina.
FROM build AS migrate
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Só as dependências de produção, sem rodar scripts de instalação de terceiros.
# O bcrypt traz o binário pronto, e o cliente do Prisma vem gerado do estágio build.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main"]

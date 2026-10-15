# syntax=docker/dockerfile:1

# Painel (Next.js) de produção, no modo "standalone": a imagem final leva só o
# servidor e as dependências que ele usa. Construir com --pull de tempos em
# tempos para receber as correções de segurança da imagem base.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
# O next.config.ts só liga o modo standalone com esta variável, para o
# "npm run build" e o "next start" do dia a dia continuarem iguais.
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
# HOSTNAME precisa ser fixado: o Docker o define como o id do container, e o
# servidor passaria a escutar só nesse endereço.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/login', { redirect: 'manual' }).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]

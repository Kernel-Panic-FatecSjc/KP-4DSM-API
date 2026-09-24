# Imagem única do backend, promovida sem rebuild por homologação e produção
# (docs/CD.md, estágio 1). Node 24 pelo mesmo motivo do job de testes do CI:
# @nestjs/common@12 é ESM-only.
FROM node:24-slim AS base
WORKDIR /app
# O schema engine do Prisma (usado por `prisma migrate deploy`) depende de openssl.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# As devDependencies ficam na imagem de propósito: as migrations
# (`prisma migrate deploy`, CLI em devDependencies) e o seed (ts-node) rodam a
# partir desta mesma imagem no deploy. Separar uma imagem "migrator" quebraria a
# regra de promover exatamente o mesmo artefato entre os ambientes.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/prisma7.config.ts /app/tsconfig.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/main"]

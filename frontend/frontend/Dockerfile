# Imagem única do frontend, promovida sem rebuild entre ambientes (docs/CD.md).
# NEXT_PUBLIC_API_URL é embutida no bundle em tempo de build, então ela é fixa
# em "/api": o Caddy de cada ambiente encaminha /api/* para o backend, e a mesma
# imagem funciona em homologação e produção.
FROM node:20-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=/api
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

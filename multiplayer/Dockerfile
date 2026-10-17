FROM caddy:2-alpine AS caddy
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/engine.ts src/engine.ts
COPY multiplayer/build.mjs multiplayer/build.mjs
RUN node multiplayer/build.mjs && npm prune --omit=dev
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=caddy /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/multiplayer/engine.mjs ./multiplayer/engine.mjs
COPY package.json ./
COPY multiplayer ./multiplayer
EXPOSE 80 443
CMD ["node","multiplayer/bootstrap.mjs"]

# syntax=docker/dockerfile:1

# ---- Build stage: install deps and build the frontend bundle ----
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: only what's needed to run the server ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Single port used both to serve the built frontend and the API in this
# container. Override with -e PORT=xxxx / docker-compose "environment" if
# needed - see .env.example for all supported variables.
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY server.js ./server.js
COPY server ./server

# Local Gateway profile metadata (never credentials - see server/credentials.js)
# is persisted here. Mount a volume at /app/data to keep Gateways
# configured across container restarts/upgrades:
#   - docker-compose: use a "volumes:" entry (see docker-compose.yml)
#   - Railway: attach a Railway Volume mounted at /app/data
# (No Dockerfile VOLUME instruction here - Railway's builder rejects it;
# use the platform-native volume mechanism instead.)
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

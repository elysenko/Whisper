# Base
FROM node:18-alpine AS base
WORKDIR /usr/src
COPY constants.json .

# Client build: compile static assets once (no dev server in the image)
FROM base AS client-build
WORKDIR /usr/src/client
COPY client/package* ./
RUN npm ci --include=dev --ignore-scripts
COPY client/ .
# Empty VITE_SOCKET_URL = same origin (the server serves the client).
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# Server: production dependencies only
FROM base AS server-deps
WORKDIR /usr/src/server
COPY server/package* ./
RUN npm ci --omit=dev --ignore-scripts

# Dev (docker-compose): hot-reload servers, source bind-mounted
FROM base AS dev
WORKDIR /usr/src
COPY server/package* ./server/
RUN npm --prefix ./server install
COPY client/package* ./client/
RUN npm --prefix ./client install
RUN npm i -g concurrently
EXPOSE 4000 5173
CMD concurrently "npm --prefix ./server run dev" "npm --prefix ./client run dev"

# Final (deployed image): one Node process, no file watchers
FROM base AS final
ENV NODE_ENV=production PORT=80
WORKDIR /usr/src
COPY --from=server-deps /usr/src/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /usr/src/client/dist ./client/dist
EXPOSE 80
CMD ["node", "server/index.js"]

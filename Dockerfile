FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS web
ENV NODE_ENV=production APP_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
RUN mkdir -p /data/media && chown app:app /data/media
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

FROM dependencies AS tools
ENV NODE_ENV=production APP_ENV=production
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app && mkdir -p /data/media && chown app:app /data/media
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY tsconfig.json ./
USER app
CMD ["npm", "run", "worker"]

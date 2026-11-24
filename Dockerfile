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
ARG RELEASE_ID=local
ENV RELEASE_ID=$RELEASE_ID
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
ARG RELEASE_ID=local
ENV RELEASE_ID=$RELEASE_ID
ENV NODE_ENV=production APP_ENV=production
# Backup tooling: PostgreSQL 16 client (must match the server major version;
# Debian bookworm ships 15) from the official PGDG repository, and restic.
# The PGDG signing key is kept in the repo (fingerprint
# B97B 0AFC AA1A 47F0 44F2 44A0 7FCC 7D46 ACCC 4CF8, no expiry) because
# downloading it from postgresql.org on every build failed twice on 17 Nov 2026.
# apt reads the armored .asc directly, so curl and gnupg are not needed.
COPY docker/postgresql-ACCC4CF8.asc /usr/share/keyrings/pgdg.asc
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates restic \
 && echo "deb [signed-by=/usr/share/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* \
 && pg_dump --version && restic version
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app && mkdir -p /data/media && chown app:app /data/media
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY tsconfig.json ./
USER app
CMD ["npm", "run", "db:migrate"]

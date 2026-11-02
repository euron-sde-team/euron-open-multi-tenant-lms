# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# One image per API, from one Dockerfile:
#
#   docker build -f infra/docker/api.Dockerfile --build-arg APP=console-api -t open-mtlms-console-api .
#   docker build -f infra/docker/api.Dockerfile --build-arg APP=admin-api   -t open-mtlms-admin-api .
#   docker build -f infra/docker/api.Dockerfile --build-arg APP=learner-api -t open-mtlms-learner-api .
#
# Each runtime image runs:
#
#   node dist/index.js                 HTTP on PORT, a node cluster (one worker per CPU in
#                                      production); background jobs run in-process
#   node db/migrate.js [--status]      forward-only SQL migrations (db/migrations), the
#                                      one-off migrate task; every API image carries it
#   node dist-scripts/scripts/<x>.js   compiled scripts, when the app ships a
#                                      tsconfig.scripts.json (console-api: bootstrap-operator)
#
# `--target tools` is the full workspace (sources, dev dependencies, pnpm, tsx) as an
# unprivileged user: `make demo` runs the seeds in it.
#
# The API is compiled with tsc (its `build` script). db/migrate.ts is transpiled to
# CommonJS next to the migrations, so the runtime needs no TypeScript toolchain.
# Production dependencies only, from `pnpm deploy --prod`. The RDS certificate bundle is
# baked in: with NODE_EXTRA_CA_CERTS pointing at it and PGSSLMODE=verify-full (set by the
# Terraform task definitions), the pg driver verifies the database certificate and host.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_IMAGE=node:22.23.4-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TZ=UTC
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP
RUN test -n "$APP" || { echo "build arg APP is required (console-api | admin-api | learner-api)"; exit 1; }
# Download every package in the lockfile first: this layer only changes with the lockfile.
# package.json too: it pins the pnpm version (packageManager) and carries the overrides
# the frozen lockfile is checked against.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@open-mtlms/${APP}..."
RUN pnpm --filter "@open-mtlms/${APP}" run build
# Optional compiled scripts (seeds, operator bootstrap) for one-off tasks on AWS.
RUN if [ -f "apps/${APP}/tsconfig.scripts.json" ]; then \
      cd "apps/${APP}" && node_modules/.bin/tsc -p tsconfig.scripts.json --noEmit false --outDir dist-scripts --sourceMap false; \
    else mkdir -p "apps/${APP}/dist-scripts"; fi
# db/migrate.ts as CommonJS, next to the migrations it applies.
RUN mkdir -p /out/db && cp -r db/migrations /out/db/migrations && node -e " \
  const ts = require('/repo/apps/${APP}/node_modules/typescript'); \
  const fs = require('fs'); \
  const out = ts.transpileModule(fs.readFileSync('db/migrate.ts', 'utf8'), { compilerOptions: { \
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }); \
  fs.writeFileSync('/out/db/migrate.js', out.outputText);"
# Production dependencies of this API only, as a self-contained node_modules.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter "@open-mtlms/${APP}" deploy --prod /out/app \
 && rm -rf /out/app/dist /out/app/dist-scripts /out/app/src /out/app/tests \
 && cp -r "apps/${APP}/dist" /out/app/dist && cp -r "apps/${APP}/dist-scripts" /out/app/dist-scripts

# The whole workspace with dev dependencies, for seeds and other tsx scripts.
FROM build AS tools
ARG APP
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@open-mtlms/${APP}..." --filter "." \
 && chown -R node:node /repo
USER node
CMD ["pnpm", "db:migrate", "--status"]

FROM ${NODE_IMAGE} AS runtime
ARG APP
ARG PORT=5076
# LOCAL_STORAGE_DIR only matters when no S3 bucket is configured (local disk storage).
ENV NODE_ENV=production TZ=UTC PORT=${PORT} APP=${APP} HEALTH_PATH=/api/v1/health \
    MIGRATIONS_DIR=/app/db/migrations LOCAL_STORAGE_DIR=/tmp/local-storage
WORKDIR /app
# tini reaps zombies and forwards SIGTERM so the cluster drains and the jobs stop cleanly.
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* && mkdir -p /app/certs
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
COPY --from=build --chown=node:node /out/app ./
COPY --from=build --chown=node:node /out/db ./db
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+process.env.HEALTH_PATH).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/index.js"]

# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# One image per Next.js app, from one Dockerfile. Each runs as a Node server
# (`next start`, or the standalone server.js when the app sets output: "standalone"),
# so SSR (the storefront's per-tenant theming) works:
#
#   docker build -f infra/docker/next.Dockerfile --build-arg APP=console -t open-mtlms-console .
#   docker build -f infra/docker/next.Dockerfile --build-arg APP=admin   -t open-mtlms-admin .
#   docker build -f infra/docker/next.Dockerfile --build-arg APP=web     -t open-mtlms-web .
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build args and
# the image is built per deployment. Server-only settings (API_INTERNAL_BASE_URL, the
# address SSR uses to reach the learner API) are runtime environment.
#
# On ECS the root filesystem is read-only; .next/cache (ISR and image optimisation) is
# a writable task volume (the service module's writable_paths).
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_IMAGE=node:22.23.4-bookworm-slim

FROM ${NODE_IMAGE} AS build
ARG APP
RUN test -n "$APP" || { echo "build arg APP is required (console | admin | web)"; exit 1; }
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TZ=UTC NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@open-mtlms/${APP}..."

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_ROOT_DOMAIN=lvh.me
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ARG NEXT_PUBLIC_CONSOLE_URL=""
ARG NEXT_PUBLIC_ADMIN_URL=""
ARG NEXT_PUBLIC_WEB_BASE_URL=""
ARG NEXT_PUBLIC_LEARNER_API_BASE_URL=""
ARG NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL=""
ARG NEXT_PUBLIC_BRAND_NAME="Open LMS Cloud"
# Where the admin app's /api/proxy rewrite sends requests. Rewrites are fixed at
# build time, and inside a container "localhost" is the container itself.
ARG API_PROXY_TARGET=""
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_ROOT_DOMAIN=${NEXT_PUBLIC_ROOT_DOMAIN} \
    NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST} \
    NEXT_PUBLIC_CONSOLE_URL=${NEXT_PUBLIC_CONSOLE_URL} \
    NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL} \
    NEXT_PUBLIC_WEB_BASE_URL=${NEXT_PUBLIC_WEB_BASE_URL} \
    NEXT_PUBLIC_LEARNER_API_BASE_URL=${NEXT_PUBLIC_LEARNER_API_BASE_URL} \
    NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL=${NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL} \
    NEXT_PUBLIC_BRAND_NAME=${NEXT_PUBLIC_BRAND_NAME} \
    NODE_ENV=production
# The app and the workspace packages it depends on (tsup builds), in dependency order.
RUN pnpm --filter "@open-mtlms/${APP}..." run build

# Assemble /out. With output: "standalone" the traced server is self-contained; without
# it, the built workspace runs `next start` from the app directory.
RUN set -e; mkdir -p /out; \
    if [ -d "apps/${APP}/.next/standalone" ]; then \
      cp -r "apps/${APP}/.next/standalone/." /out/; \
      mkdir -p "/out/apps/${APP}/.next"; \
      cp -r "apps/${APP}/.next/static" "/out/apps/${APP}/.next/static"; \
      if [ -d "apps/${APP}/public" ]; then cp -r "apps/${APP}/public" "/out/apps/${APP}/public"; fi; \
      printf '#!/bin/sh\ncd /app/apps/%s && exec node server.js\n' "$APP" > /out/start.sh; \
    else \
      rm -rf "apps/${APP}/.next/cache"; \
      cp -r /repo/. /out/; \
      printf '#!/bin/sh\ncd /app/apps/%s && exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"\n' "$APP" > /out/start.sh; \
    fi; \
    mkdir -p "/out/apps/${APP}/.next/cache"; \
    chmod 755 /out/start.sh

FROM ${NODE_IMAGE} AS runtime
ARG APP
ARG PORT=3600
ENV NODE_ENV=production TZ=UTC PORT=${PORT} HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 APP=${APP}
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/start.sh"]

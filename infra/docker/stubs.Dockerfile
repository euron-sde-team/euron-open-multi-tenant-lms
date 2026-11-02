# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# The provider stubs (apps/stubs): Stripe, Razorpay, EVS and an OpenAI-compatible API,
# simulated for local stacks and CI. Dependency-free; Node 22.18+ runs the TypeScript
# sources directly (type stripping), so there is no install or build step.
#
#   docker build -f infra/docker/stubs.Dockerfile -t open-mtlms-stubs .
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_IMAGE=node:22.23.4-bookworm-slim

FROM ${NODE_IMAGE}
ENV NODE_ENV=production TZ=UTC PORT=5189 NODE_NO_WARNINGS=1
WORKDIR /app
COPY --chown=node:node apps/stubs/package.json ./package.json
COPY --chown=node:node apps/stubs/src ./src
COPY --chown=node:node apps/stubs/assets ./assets
USER node
EXPOSE 5189
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.ts"]

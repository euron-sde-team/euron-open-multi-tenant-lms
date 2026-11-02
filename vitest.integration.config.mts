/**
 * Integration tests across the three APIs, run by `make test-integration` (and CI) against
 * a real Postgres 16 and Redis 7: scripts/test-db.sh recreates the test database
 * (open_mtlms_test unless TEST_DB says otherwise), the migrations and the catalog seed
 * run, then this suite. Each API keeps its specs in apps/<api>/tests/integration/*.test.ts;
 * the shared harness (apps booted in-process on ephemeral ports, the provider stubs, the
 * fixtures) lives in apps/admin-api/tests/integration/support.
 *
 * Every spec creates its own tenants, so files only need the seeded catalog. They run one
 * at a time all the same: they share one database and one Redis.
 *
 * Isolation from anything else on the machine: the database name must end in _test (the
 * harness refuses otherwise), Redis is logical DB 5 with a private BullMQ prefix and a
 * private cache-bus prefix, and every secret below is a throwaway.
 */
import { defineConfig } from "vitest/config";

const env = (name: string, fallback: string) => process.env[name] || fallback;

export default defineConfig({
  test: {
    include: ["apps/{console-api,admin-api,learner-api}/tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    passWithNoTests: false,
    env: {
      TZ: "UTC",
      NODE_ENV: "test",
      LOG_LEVEL: env("LOG_LEVEL", "error"),
      PG_DATABASE_HOST: env("PG_DATABASE_HOST", "127.0.0.1"),
      PG_DATABASE_PORT: env("PG_DATABASE_PORT", "5542"),
      PG_DATABASE_USER: env("PG_DATABASE_USER", "postgres"),
      PG_DATABASE_PASSWORD: env("PG_DATABASE_PASSWORD", "postgres"),
      PG_DATABASE: env("PG_DATABASE", "open_mtlms_test"),
      PG_POOL_MAX: "4",
      REDIS_HOST: env("REDIS_HOST", "127.0.0.1"),
      REDIS_PORT: env("REDIS_PORT", "6479"),
      REDIS_DB: env("REDIS_DB", "5"),
      REDIS_URL: "",
      BULLMQ_PREFIX: env("BULLMQ_PREFIX", "mtlms-it"),
      CACHE_BUS_PREFIX: env("CACHE_BUS_PREFIX", "mtlms-it:"),
      ROOT_DOMAIN: "lvh.me",
      JWT_SECRET: env("JWT_SECRET", "integration-only-jwt-secret-not-for-production"),
      CREDENTIALS_ENCRYPTION_KEY: env("CREDENTIALS_ENCRYPTION_KEY", "integration-only-credentials-key-not-for-prod"),
      INTERNAL_API_KEY: env("INTERNAL_API_KEY", "integration-only-internal-api-key-not-for-prod"),
      // No real email, analytics or cloud calls from a test run.
      AWS_SES_ACCESS_KEY: "",
      AWS_SES_SECRET_KEY: "",
      CLOUDWATCH_LOGS_ID: "",
      POSTHOG_PERSONAL_API_KEY: "",
      OPEN_EXCHANGE_RATES_API_KEY: "",
      AI_PROVIDER: "offline",
    },
  },
});

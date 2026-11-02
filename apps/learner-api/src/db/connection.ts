import cluster from "cluster";
import { Kysely, PostgresDialect } from "kysely";
import pg, { Pool, PoolConfig } from "pg";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { DB } from "./types";

// ─── Type coercion ──────────────────────────────────────────────────────────
// Force `timestamp without time zone` (1114) to parse as UTC. Prisma uses
// `timestamp(3) without time zone` for DateTime; without this, pg interprets
// the raw value in the host timezone, shifting every timestamp by the local
// offset on non-UTC hosts.
pg.types.setTypeParser(1114, (val: string) => new Date(val + "+00"));

// ─── Pool sizing & timeouts ─────────────────────────────────────────────────
//
// Connection budget for a multi-tenant grid deployment:
//   per_instance_connections = num_cluster_workers × PG_POOL_MAX
//   total_app_connections    = sum across all backends and machines
//   safe_total                ≤ rds_max_connections − rds_reserved (≈ 3) − other_clients
//
// Beyond a single machine, run RDS Proxy or PgBouncer in transaction-pool
// mode in front of these pools. The Node-side pool then becomes a small
// per-process buffer instead of a hard floor on RDS connection count.
//
// Dev defaults are deliberately small. tsx watch + turbo dev frequently
// leave zombie processes around, each holding a pool; a small dev cap
// prevents stale processes from monopolizing the shared RDS budget.

const getPoolConfig = (): PoolConfig => {
  const workerLabel =
    cluster.isWorker && cluster.worker ? `w${cluster.worker.id}` : "primary";
  const isProd = process.env.NODE_ENV === "production";

  const baseConfig: PoolConfig = {
    host: config.PG_DATABASE_HOST,
    user: config.PG_DATABASE_USER,
    password: config.PG_DATABASE_PASSWORD,
    port: Number(config.PG_DATABASE_PORT),
    database: config.PG_DATABASE,
    application_name: `learner-api-${workerLabel}-${process.pid}`,
    keepAlive: true,
  };

  baseConfig.max = config.PG_POOL_MAX
    ? Number(config.PG_POOL_MAX)
    : isProd
      ? 8
      : 4;
  baseConfig.min = config.PG_POOL_MIN ? Number(config.PG_POOL_MIN) : 0;

  // Fail fast under saturation: don't queue acquire-promises for 10s when
  // the pool is the bottleneck, let backpressure surface so the LB can
  // route around the bad instance.
  baseConfig.connectionTimeoutMillis = config.PG_CONNECTION_TIMEOUT
    ? Number(config.PG_CONNECTION_TIMEOUT)
    : 5000;

  baseConfig.idleTimeoutMillis = config.PG_IDLE_TIMEOUT
    ? Number(config.PG_IDLE_TIMEOUT)
    : isProd
      ? 10000
      : 5000;

  // Statement-level kill switch. Long live-HTTP queries hold a connection
  // slot for the full duration and starve the pool. 30s is generous for
  // every endpoint here; long-running work belongs in a BullMQ job.
  baseConfig.statement_timeout = 30000;

  return baseConfig;
};

// ─── Pool & Kysely instances ────────────────────────────────────────────────
export const pool = new Pool(getPoolConfig());

// Surface idle-client errors (pg fires this on backend disconnect: RDS
// failover, network blip, idle timeout from the server side, etc.). The
// pool removes the dead client itself; we just log so it's observable
// rather than silently happening or crashing the process.
pool.on("error", (err) => {
  logger.error("[pg-pool] idle client error:", err);
});

const dialect = new PostgresDialect({ pool });
export const db = new Kysely<DB>({ dialect });

// ─── Lifecycle helpers ──────────────────────────────────────────────────────

/**
 * Probe the DB on worker startup with exponential backoff. Survives RDS
 * failover (~30s) and transient network issues without killing the worker
 * and entering a cluster restart loop.
 */
export const waitForDBConnection = async (
  attempts = 5,
  baseDelayMs = 500
): Promise<void> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        logger.info(
          i === 0
            ? "Database connected"
            : `Database connected after ${i + 1} attempt(s)`
        );
        return;
      } finally {
        client.release();
      }
    } catch (error) {
      lastErr = error;
      const delay = baseDelayMs * Math.pow(2, i); // 0.5s, 1s, 2s, 4s, 8s
      logger.warn(
        `[pg-pool] connect attempt ${i + 1}/${attempts} failed (${(error as Error)?.message ?? error}); retrying in ${delay}ms`
      );
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  logger.error("[pg-pool] all connect attempts exhausted:", lastErr);
  throw new BadRequestError("Database connection failed");
};

/**
 * Gracefully drain the pool. Call from SIGTERM/SIGINT handlers BEFORE
 * exiting so in-flight queries complete and Postgres sees clean
 * disconnects (immediate slot release, no tcp_keepalive_idle wait).
 */
export const closeDBConnection = async (): Promise<void> => {
  try {
    logger.info("Closing database connection pool...");
    await pool.end();
    logger.info("Database connection pool closed");
  } catch (error) {
    logger.error("Error closing database connection pool:", error);
    throw error;
  }
};

/**
 * Snapshot of pool utilization for /health endpoints and dashboards.
 * `waitingCount > 0` sustained = pool is the bottleneck. Bump
 * `PG_POOL_MAX` if RDS has headroom, or front the pools with PgBouncer.
 */
export const getPoolStats = () => ({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount,
});

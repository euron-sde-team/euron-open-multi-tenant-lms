import cluster from "cluster";
import { Kysely, PostgresDialect } from "kysely";
import pg, { Pool, PoolConfig } from "pg";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { DB } from "./types";

// ─── Type coercion ──────────────────────────────────────────────────────────
// Force `timestamp without time zone` (1114) to parse as UTC.
pg.types.setTypeParser(1114, (val: string) => new Date(val + "+00"));
// Force Date serialization to use UTC. Without this, pg serializes Dates in
// local time on INSERT but the parser above reads them as UTC, mismatch on
// non-UTC hosts shifts every timestamp by the local offset.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pg.defaults as any).parseInputDatesAsUTC = true;

// ─── Pool sizing & timeouts ─────────────────────────────────────────────────
//
// Connection budget for a multi-tenant grid deployment:
//   per_instance_connections = num_cluster_workers × PG_POOL_MAX
//   total_app_connections    = sum(per_instance_connections across all backends and machines)
//   safe_total                ≤ rds_max_connections − rds_reserved (≈ 3) − other_clients
//
// Example (m5.large RDS, max_connections = 1000):
//   3 backends × 4 machines × 8 workers × 8 max = 3072  →  EXCEEDS budget; need PgBouncer.
//   3 backends × 1 machine  × 8 workers × 8 max = 192   →  fits; reserves headroom for bg jobs.
//
// At any sustained scale beyond a single machine you should run RDS Proxy or
// PgBouncer in transaction-pool mode in front of these pools. The Node-side
// pool then becomes a small per-process buffer instead of a hard floor.
//
// Dev defaults are deliberately small. tsx watch + turbo dev frequently leaves
// zombie processes around, each holding a pool; a small dev cap prevents one
// stale process from monopolizing the RDS connection budget.

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
    // Surface this pool in pg_stat_activity for leak/saturation debugging.
    application_name: `tenant-admin-${workerLabel}-${process.pid}`,
    keepAlive: true,
  };

  baseConfig.max = config.PG_POOL_MAX
    ? Number(config.PG_POOL_MAX)
    : isProd
      ? 8
      : 10;
  baseConfig.min = config.PG_POOL_MIN ? Number(config.PG_POOL_MIN) : 0;

  // Fail fast under saturation. With a 10s wait, a thousand queued requests
  // each hold a connection-acquire promise for 10s, multiplying memory pressure
  // and prolonging cascading failure. 5s is enough for a healthy pool to
  // service waiters; longer just hides backpressure that should bubble up.
  // Dev runs a single cluster worker against a remote RDS, where bursty BullMQ
  // job loads can briefly saturate the pool, a 15s window absorbs those bursts
  // without masking a real production-grade backpressure problem.
  baseConfig.connectionTimeoutMillis = config.PG_CONNECTION_TIMEOUT
    ? Number(config.PG_CONNECTION_TIMEOUT)
    : isProd
      ? 10000
      : 15000;

  // Release idle connections back to RDS aggressively. Bursty traffic + a
  // shared RDS budget across multiple backends means long-idle conns are
  // dead weight against a scarce slot budget.
  baseConfig.idleTimeoutMillis = config.PG_IDLE_TIMEOUT
    ? Number(config.PG_IDLE_TIMEOUT)
    : isProd
      ? 10000
      : 5000;

  // Statement-level kill switch. Long queries hold a connection slot for the
  // full duration, so a runaway can starve the entire pool. 30s is generous
  // for the consolidated analytics queries; anything longer should be a
  // background job (BullMQ) with its own connection lifecycle, not a live HTTP
  // request. Per-query overrides via SET LOCAL statement_timeout are still
  // possible inside an explicit transaction.
  baseConfig.statement_timeout = 30000;

  return baseConfig;
};

// ─── Pool & Kysely instances ────────────────────────────────────────────────
export const pool = new Pool(getPoolConfig());

// Surface idle-client errors instead of letting them bubble as unhandled
// rejections. pg fires this when a backend connection is dropped (RDS
// failover, network blip, idle timeout from the server side, etc.). The
// pool removes the dead client itself; we just need to log so it shows up
// in observability and isn't treated as a process-wide crash signal.
pool.on("error", (err) => {
  logger.error("[pg-pool] idle client error:", err);
});

const dialect = new PostgresDialect({ pool });
export const db = new Kysely<DB>({ dialect });

// ─── Lifecycle helpers ──────────────────────────────────────────────────────

/**
 * Probe the DB on worker startup. Retries with exponential backoff to survive
 * transient unavailability (RDS failover takes ~30s, network blips ~1–5s).
 * Without retry, a fresh deploy that races RDS failover causes every worker
 * to die and the cluster to enter a restart loop.
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
 * exiting; ensures in-flight queries complete and Postgres sees clean
 * disconnects (which release slots immediately rather than waiting for
 * tcp_keepalive_idle on the server side).
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
 * Snapshot of pool utilization for /health endpoints, dashboards, or debug
 * logs. `waitingCount > 0` for any sustained period means the pool is the
 * bottleneck, either bump `PG_POOL_MAX` (if RDS has headroom) or put a
 * connection pooler (PgBouncer / RDS Proxy) in front.
 */
export const getPoolStats = () => ({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount,
});

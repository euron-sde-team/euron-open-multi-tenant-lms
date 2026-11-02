import { Kysely, PostgresDialect } from "kysely";
import pg, { Pool, PoolConfig } from "pg";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { DB } from "./types";

// timestamp without time zone (OID 1114) is stored as UTC; read it as UTC.
pg.types.setTypeParser(1114, (val: string) => new Date(val + "+00"));

// Calculate optimal pool size per worker
// Default: 10 connections per pool, but we'll make it configurable
// Formula: Ensure total connections (workers * poolMax) don't exceed DB max_connections
const getPoolConfig = (): PoolConfig => {
  const baseConfig: PoolConfig = {
    host: config.PG_DATABASE_HOST,
    user: config.PG_DATABASE_USER,
    password: config.PG_DATABASE_PASSWORD,
    port: Number(config.PG_DATABASE_PORT),
    database: config.PG_DATABASE,
  };

  // Configure pool size if provided in config
  // Default pg pool max is 10, min is 0
  // For production with multiple workers, consider:
  // - max: Math.floor(DB_MAX_CONNECTIONS / NUM_WORKERS) - 2 (reserve for admin)
  if (config.PG_POOL_MAX) {
    baseConfig.max = Number(config.PG_POOL_MAX);
  }
  if (config.PG_POOL_MIN) {
    baseConfig.min = Number(config.PG_POOL_MIN);
  }

  // Connection timeout and idle timeout
  baseConfig.connectionTimeoutMillis = config.PG_CONNECTION_TIMEOUT
    ? Number(config.PG_CONNECTION_TIMEOUT)
    : 10000; // 10 seconds default
  baseConfig.idleTimeoutMillis = config.PG_IDLE_TIMEOUT
    ? Number(config.PG_IDLE_TIMEOUT)
    : 30000; // 30 seconds default

  return baseConfig;
};

export const pool = new Pool(getPoolConfig());

const dialect = new PostgresDialect({
  pool
});

export const db = new Kysely<DB>({ dialect });

export const waitForDBConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info("Database connected");
    client.release();
  } catch (error) {
    logger.error(error);
    logger.error("Database connection failed");
    throw new BadRequestError("Database connection failed");
  }
};

/**
 * Gracefully close all database connections
 * Should be called during worker shutdown
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


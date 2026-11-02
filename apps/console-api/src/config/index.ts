import dotenv from "dotenv";
dotenv.config();

// Local-only defaults. assertProductionConfig() refuses to boot with these
// when NODE_ENV=production.
const DEV_JWT_SECRET = "dev-only-console-jwt-secret-change-me";
const DEV_ENCRYPTION_KEY = "dev-only-credentials-encryption-key-change-me";
const DEV_APP_CONFIG_SALT = "open-lms-application-config-salt";

const NODE_ENV = process.env.NODE_ENV || "development";

const config = {
  // Browser origins allowed to call the operator API (the console).
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:3600")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),
  // Proxy hops in front of the API: 1 behind the ALB, 0 when exposed directly.
  TRUST_PROXY: Number.parseInt(process.env.TRUST_PROXY || "1", 10) || 0,
  NODE_ENV,
  isProduction: NODE_ENV === "production",
  PORT: process.env.PORT || "5076",

  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || "24h",

  SERVER_NAME: `${process.env.SERVER_NAME || "console-api"}-${NODE_ENV}`,

  PG_DATABASE_HOST: process.env.PG_DATABASE_HOST || "localhost",
  PG_DATABASE_USER: process.env.PG_DATABASE_USER || "postgres",
  PG_DATABASE_PASSWORD: process.env.PG_DATABASE_PASSWORD || "postgres",
  PG_DATABASE_PORT: process.env.PG_DATABASE_PORT || "5542",
  PG_DATABASE: process.env.PG_DATABASE || "open_mtlms",

  // Connection pool configuration (per worker)
  // Recommended: Set PG_POOL_MAX based on: (DB_MAX_CONNECTIONS / NUM_WORKERS) - 2
  PG_POOL_MAX: process.env.PG_POOL_MAX, // Max connections per worker pool (default: 10)
  PG_POOL_MIN: process.env.PG_POOL_MIN, // Min connections per worker pool (default: 0)
  PG_CONNECTION_TIMEOUT: process.env.PG_CONNECTION_TIMEOUT, // Connection timeout in ms (default: 10000)
  PG_IDLE_TIMEOUT: process.env.PG_IDLE_TIMEOUT, // Idle connection timeout in ms (default: 30000)

  // Logs go to stdout (ECS ships them). LOG_FILE adds a file transport.
  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
  LOG_FILE: process.env.LOG_FILE || "",

  // AES-256-GCM key for secrets stored inside application config JSON.
  CREDENTIALS_ENCRYPTION_KEY:
    process.env.CREDENTIALS_ENCRYPTION_KEY || DEV_ENCRYPTION_KEY,
  APP_CONFIG_SALT: process.env.APP_CONFIG_SALT || DEV_APP_CONFIG_SALT,

  // Service-to-service key (not used by console-api routes today; validated
  // when set so every API shares one rule).
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "",

  // Operator email (SES v2). Emails are skipped when the SES keys are unset.
  AWS_SES_REGION: process.env.AWS_SES_REGION || "us-east-1",
  AWS_SES_ACCESS_KEY: process.env.AWS_SES_ACCESS_KEY || "",
  AWS_SES_SECRET_KEY: process.env.AWS_SES_SECRET_KEY || "",
  SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || process.env.SES_FROM_EMAIL || "noreply@example.com",
  SES_FROM_NAME: process.env.AWS_SES_FROM_NAME || process.env.SES_FROM_NAME || "Open LMS Cloud",

  // Brute-force limits on operator login (per window).
  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  AUTH_RATE_LIMIT_PER_IP: Number(process.env.AUTH_RATE_LIMIT_PER_IP || 30),
  AUTH_RATE_LIMIT_PER_EMAIL: Number(process.env.AUTH_RATE_LIMIT_PER_EMAIL || 10),

  // Platform identity
  PLATFORM_NAME: process.env.PLATFORM_NAME || "Open LMS Cloud",
  /** Root domain tenant subdomains live under (northwind.lvh.me locally). */
  ROOT_DOMAIN: process.env.ROOT_DOMAIN || "lvh.me",
  DEFAULT_SUPPORT_EMAIL:
    process.env.DEFAULT_SUPPORT_EMAIL || "support@example.com",
  CONSOLE_URL: process.env.CONSOLE_URL || "http://localhost:3600",
};

export function assertProductionConfig(c: typeof config = config): void {
  if (!c.isProduction) return;
  const problems: string[] = [];
  if (c.JWT_SECRET === DEV_JWT_SECRET || c.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be set to a random value of at least 32 characters");
  }
  if (
    c.CREDENTIALS_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY ||
    c.CREDENTIALS_ENCRYPTION_KEY.length < 32
  ) {
    problems.push(
      "CREDENTIALS_ENCRYPTION_KEY must be set to a random value of at least 32 characters"
    );
  }
  if (c.INTERNAL_API_KEY && c.INTERNAL_API_KEY.length < 32) {
    problems.push("INTERNAL_API_KEY, when set, must be at least 32 characters");
  }
  if (c.APP_CONFIG_SALT === DEV_APP_CONFIG_SALT) {
    problems.push("APP_CONFIG_SALT must be set to a random value");
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join("\n  - ")}`);
  }
}

export default config;

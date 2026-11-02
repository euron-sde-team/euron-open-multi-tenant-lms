import dotenv from "dotenv";
dotenv.config();

// Local-only defaults. assertProductionConfig() refuses to boot with these
// when NODE_ENV=production.
const DEV_JWT_SECRET = "dev-only-learner-jwt-secret-change-me";
const DEV_ENCRYPTION_KEY = "dev-only-credentials-encryption-key-change-me";
const DEV_INTERNAL_API_KEY = "dev-only-internal-api-key-change-me";

const NODE_ENV = process.env.NODE_ENV ?? "development";
const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";

// REDIS_URL (redis[s]://[user:password@]host:port[/db]) wins over REDIS_HOST/
// REDIS_PORT/REDIS_PASSWORD/REDIS_DB. AWS injects only REDIS_URL, as rediss://.
const redisUrl = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;

const trimSlash = (v: string) => v.replace(/\/$/, "");
const s3PublicBase = (bucket: string) => `https://${bucket}.s3.${AWS_REGION}.amazonaws.com`;
const csv = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// One bucket by default (AWS_S3_BUCKET, as Terraform and the Floci overlay
// provision it); the per-purpose names exist only to split them later.
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? "";
const TENANT_DETAILS_S3_BUCKET =
  process.env.TENANT_DETAILS_S3_BUCKET || AWS_S3_BUCKET || "open-mtlms-assets";
const THUMBNAILS_S3_BUCKET = process.env.THUMBNAILS_S3_BUCKET || AWS_S3_BUCKET || "open-mtlms-assets";
// Public media base (a CDN, or the bucket's public prefix); wins over the
// derived bucket URL.
const AWS_S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL?.trim() ?? "";

const config = {
  // Proxy hops in front of the API: 1 behind the ALB, 0 when exposed directly.
  // Multiplies every sign-in, sign-up and OTP rate limit (1 = the defaults).
  AUTH_RATE_LIMIT_SCALE: Number(process.env.AUTH_RATE_LIMIT_SCALE || 1) || 1,
  TRUST_PROXY: Number.parseInt(process.env.TRUST_PROXY ?? "1", 10) || 0,
  NODE_ENV,
  isProduction: NODE_ENV === "production",
  PORT: process.env.PORT ?? "5096",

  JWT_SECRET: process.env.JWT_SECRET ?? DEV_JWT_SECRET,
  // Signs learner tokens only, so a staff or operator token signed with the
  // shared JWT_SECRET never verifies here. Falls back to JWT_SECRET outside
  // production; assertProductionConfig requires its own strong value.
  LEARNER_JWT_SECRET:
    process.env.LEARNER_JWT_SECRET ||
    (NODE_ENV === "production" ? "" : (process.env.JWT_SECRET ?? DEV_JWT_SECRET)),
  JWT_EXPIRY: process.env.JWT_EXPIRY ?? "30d",

  SERVER_NAME: `${process.env.SERVER_NAME ?? "learner-api"}-${NODE_ENV}`,

  PG_DATABASE_HOST: process.env.PG_DATABASE_HOST ?? "localhost",
  PG_DATABASE_USER: process.env.PG_DATABASE_USER ?? "postgres",
  PG_DATABASE_PASSWORD: process.env.PG_DATABASE_PASSWORD ?? "postgres",
  PG_DATABASE_PORT: process.env.PG_DATABASE_PORT ?? "5542",
  PG_DATABASE: process.env.PG_DATABASE ?? "open_mtlms",

  // Connection pool configuration (per worker)
  // Recommended: Set PG_POOL_MAX based on: (DB_MAX_CONNECTIONS / NUM_WORKERS) - 2
  PG_POOL_MAX: process.env.PG_POOL_MAX, // Max connections per worker pool (default: 10)
  PG_POOL_MIN: process.env.PG_POOL_MIN, // Min connections per worker pool (default: 0)
  PG_CONNECTION_TIMEOUT: process.env.PG_CONNECTION_TIMEOUT, // Connection timeout in ms (default: 10000)
  PG_IDLE_TIMEOUT: process.env.PG_IDLE_TIMEOUT, // Idle connection timeout in ms (default: 30000)

  // Platform identity
  PLATFORM_NAME: process.env.PLATFORM_NAME ?? "Open LMS Cloud",
  /** Root domain tenant subdomains live under (northwind.lvh.me locally). */
  MAIN_DOMAIN: process.env.ROOT_DOMAIN ?? "lvh.me",
  /** Subdomains of MAIN_DOMAIN that never resolve to a tenant. */
  RESERVED_SUBDOMAINS: csv(process.env.RESERVED_SUBDOMAINS ?? "www,admin,api,console,api-console,api-admin,assets"),
  FRONTEND_APP_URL: process.env.FRONTEND_APP_URL ?? "http://localhost:3620",
  // Tenant admin portal URL, used for deep links in staff-facing alert emails.
  ADMIN_PORTAL_URL: process.env.ADMIN_PORTAL_URL ?? "http://localhost:3610",
  CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? "support@example.com",

  // Public asset bases. THUMBNAILS_BASE_URL / TENANT_DETAILS_BASE_URL win when
  // set (e.g. a CDN); otherwise the S3 bucket URL in AWS_REGION is used.
  THUMBNAILS_BASE_URL: trimSlash(
    process.env.THUMBNAILS_BASE_URL?.trim() || AWS_S3_PUBLIC_BASE_URL || s3PublicBase(THUMBNAILS_S3_BUCKET)
  ),
  TENANT_DETAILS_S3_BUCKET,
  TENANT_DETAILS_BASE_URL: trimSlash(
    process.env.TENANT_DETAILS_BASE_URL?.trim() || AWS_S3_PUBLIC_BASE_URL || s3PublicBase(TENANT_DETAILS_S3_BUCKET)
  ),
  S3_LECTURE_RESOURCES_BUCKET:
    process.env.S3_LECTURE_RESOURCES_BUCKET || AWS_S3_BUCKET || "open-mtlms-assets",
  /** Extra hostnames (suffix match) the certificate logo proxy may fetch from. */
  CERTIFICATE_LOGO_HOSTS: csv(
    process.env.CERTIFICATE_LOGO_HOSTS ?? "amazonaws.com,cloudfront.net"
  ),

  // AWS S3 (pre-signed URLs, streaming for private bucket objects e.g. book EPUBs/PDFs)
  AWS_REGION,
  // Floci or any S3-compatible endpoint locally; unset on AWS.
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? "",
  AWS_S3_FORCE_PATH_STYLE: (process.env.AWS_S3_FORCE_PATH_STYLE ?? "") === "true",
  AWS_S3_ACCESS_KEY: process.env.AWS_S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY ?? "",
  AWS_S3_SECRET_KEY: process.env.AWS_S3_SECRET_KEY ?? process.env.AWS_SECRET_KEY ?? "",

  // Shared secret for internal server-to-server calls (admin-api -> learner-api),
  // e.g. issuing a test certificate the instant an evaluator finishes grading.
  // Set the same INTERNAL_API_KEY on both services.
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ?? DEV_INTERNAL_API_KEY,

  // AES-256-GCM key that seals tenant payment gateway credentials at rest.
  // Must match admin-api, which writes them.
  CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY,

  // Gateway API bases (point at the local stubs in development).
  STRIPE_API_BASE: process.env.STRIPE_API_BASE ?? "",
  RAZORPAY_API_BASE: process.env.RAZORPAY_API_BASE ?? "",

  // Video service (EVS). When EVS_API_URL is unset, EVS lectures return 503.
  EVS_API_URL: trimSlash(process.env.EVS_API_URL ?? ""),
  EVS_API_KEY: process.env.EVS_API_KEY ?? "",
  EVS_PLAYBACK_TTL_SECONDS: Number(process.env.EVS_PLAYBACK_TTL_SECONDS ?? "3600"),

  // Redis pub/sub prefix for cross-API cache busting; must match the publishers.
  CACHE_BUS_PREFIX: process.env.CACHE_BUS_PREFIX ?? "lms:",

  // AWS SES (transactional email). Emails fail when the SES keys are unset.
  AWS_SES_REGION: process.env.AWS_SES_REGION ?? AWS_REGION,
  AWS_SES_ACCESS_KEY: process.env.AWS_SES_ACCESS_KEY ?? "",
  AWS_SES_SECRET_KEY: process.env.AWS_SES_SECRET_KEY ?? "",
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL ?? "noreply@example.com",

  // Email engine: platform fallback sender used whenever a tenant has no
  // verified custom sending domain.
  legacyFromEmail:
    process.env.AWS_SES_FROM_EMAIL ?? process.env.SES_FROM_EMAIL ?? "noreply@example.com",

  // Signing secret for List-Unsubscribe JWT tokens. Must match admin-api.
  EMAIL_UNSUBSCRIBE_SIGNING_SECRET:
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET ?? process.env.JWT_SECRET ?? DEV_JWT_SECRET,

  // Send pacing. Account TPS is shared with admin-api (same Redis buckets), so
  // keep both services on the same values.
  EMAIL_DEFAULT_TENANT_TPS: parseInt(process.env.EMAIL_DEFAULT_TENANT_TPS ?? "12", 10),
  EMAIL_ACCOUNT_TPS: parseInt(process.env.EMAIL_ACCOUNT_TPS ?? "25", 10),
  EMAIL_OPS_ALERT_WEBHOOK_URL: process.env.EMAIL_OPS_ALERT_WEBHOOK_URL ?? "",

  REDIS_HOST: redisUrl?.hostname || (process.env.REDIS_HOST ?? "localhost"),
  REDIS_PORT: redisUrl?.port || (process.env.REDIS_PORT ?? "6379"),
  REDIS_USERNAME: redisUrl?.username ? decodeURIComponent(redisUrl.username) : "",
  REDIS_PASSWORD:
    (redisUrl?.password ? decodeURIComponent(redisUrl.password) : "") || (process.env.REDIS_PASSWORD ?? ""),
  REDIS_DB: Number(redisUrl?.pathname.replace(/^\//, "") || process.env.REDIS_DB || 0),
  REDIS_TLS: redisUrl ? redisUrl.protocol === "rediss:" : process.env.REDIS_TLS === "true",
  // Key prefix for every BullMQ queue and worker.
  BULLMQ_PREFIX: process.env.BULLMQ_PREFIX || "bull",

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",

  // OTP settings
  OTP_EXPIRY_MINUTES: process.env.OTP_EXPIRY_MINUTES ?? "15",
  OTP_MAX_ATTEMPTS: process.env.OTP_MAX_ATTEMPTS ?? "5",
  OTP_LENGTH: process.env.OTP_LENGTH ?? "6",
};

export function assertProductionConfig(c: typeof config = config): void {
  if (!c.isProduction) return;
  const problems: string[] = [];
  if (c.JWT_SECRET === DEV_JWT_SECRET || c.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be set to a random value of at least 32 characters");
  }
  if (c.LEARNER_JWT_SECRET.length < 32 || c.LEARNER_JWT_SECRET === DEV_JWT_SECRET) {
    problems.push("LEARNER_JWT_SECRET must be set to a random value of at least 32 characters");
  } else if (c.LEARNER_JWT_SECRET === c.JWT_SECRET) {
    problems.push("LEARNER_JWT_SECRET must differ from JWT_SECRET");
  }
  if (
    c.CREDENTIALS_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY ||
    c.CREDENTIALS_ENCRYPTION_KEY.length < 32
  ) {
    problems.push(
      "CREDENTIALS_ENCRYPTION_KEY must be set to a random value of at least 32 characters"
    );
  }
  if (c.INTERNAL_API_KEY === DEV_INTERNAL_API_KEY || c.INTERNAL_API_KEY.length < 32) {
    problems.push("INTERNAL_API_KEY must be set to a random value of at least 32 characters");
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join("\n  - ")}`);
  }
}

export default config;

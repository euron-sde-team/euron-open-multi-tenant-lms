import dotenv from "dotenv";
dotenv.config();

// Local-only defaults. assertProductionConfig() refuses to boot with these
// when NODE_ENV=production.
const DEV_JWT_SECRET = "dev-only-admin-jwt-secret-change-me";
const DEV_ENCRYPTION_KEY = "dev-only-credentials-encryption-key-change-me";
const DEV_INTERNAL_API_KEY = "dev-only-internal-api-key-change-me";

const NODE_ENV = process.env.NODE_ENV || "development";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

const trimSlash = (v: string) => v.replace(/\/$/, "");
const csv = (v: string, lower = true) =>
  v
    .split(",")
    .map((s) => (lower ? s.trim().toLowerCase() : s.trim()))
    .filter(Boolean);

const env = (...names: string[]): string | undefined => {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
};
const withApiPath = (base: string | undefined, fallback: string) =>
  base ? `${trimSlash(base)}/api/v1` : fallback;

/** One assets bucket by default (AWS_S3_BUCKET); per-purpose overrides are optional. */
const AWS_S3_BUCKET = env("AWS_S3_BUCKET", "S3_BUCKET") ?? "open-mtlms-local-assets";

// REDIS_URL (redis[s]://[user:password@]host:port[/db]) wins over REDIS_HOST/REDIS_PORT.
// rediss:// (ElastiCache in-transit encryption) turns TLS on for every client.
const redisUrl = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;

const config = {
  // Proxy hops in front of the API: 1 behind the ALB, 0 when exposed directly.
  TRUST_PROXY: Number.parseInt(process.env.TRUST_PROXY || "1", 10) || 0,
  NODE_ENV,
  isProduction: NODE_ENV === "production",
  PORT: process.env.PORT || "5086",

  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || "24h",

  SERVER_NAME: `${process.env.SERVER_NAME || "admin-api"}-${NODE_ENV}`,

  /** Browser origins allowed to call this API with credentials. Empty = any (local only). */
  CORS_ORIGINS: csv(process.env.CORS_ORIGINS || "", false),

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
  PG_IDLE_TIMEOUT: process.env.PG_IDLE_TIMEOUT, // Idle connection timeout in ms (default: 10000)

  // Max in-flight DB queries per analytics request. Caps connection use even
  // when a single endpoint schedules many parallel queries.
  ANALYTICS_DB_CONCURRENCY: process.env.ANALYTICS_DB_CONCURRENCY || "4",

  // Logs go to stdout (ECS ships them). LOG_FILE adds a file transport.
  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
  LOG_FILE: process.env.LOG_FILE || "",

  // Platform identity
  PLATFORM_NAME: env("BRAND_NAME", "PLATFORM_NAME") ?? "Open LMS Cloud",
  PLATFORM_URL: env("PLATFORM_URL", "WEB_URL") ?? "https://example.com",
  PLATFORM_LOGO_URL: process.env.PLATFORM_LOGO_URL || "",
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || "support@example.com",

  // AWS S3 (uploads: thumbnails, lecture resources, tenant assets).
  // AWS_ENDPOINT_URL points the SDK at an S3-compatible emulator (Floci) and
  // switches to path-style URLs.
  AWS_REGION,
  AWS_ENDPOINT_URL: trimSlash(process.env.AWS_ENDPOINT_URL || ""),
  /**
   * Public base URL of the assets bucket (bucket included), e.g. a CDN or
   * http://localhost:4647/open-mtlms-local-assets. Object URL = base + "/" + key.
   */
  S3_PUBLIC_BASE_URL: trimSlash(env("AWS_S3_PUBLIC_BASE_URL", "S3_PUBLIC_BASE_URL") ?? ""),
  /** Endpoint browsers reach for presigned uploads when it differs from AWS_ENDPOINT_URL. */
  AWS_S3_PUBLIC_ENDPOINT: trimSlash(process.env.AWS_S3_PUBLIC_ENDPOINT || ""),
  AWS_S3_FORCE_PATH_STYLE:
    (process.env.AWS_S3_FORCE_PATH_STYLE || (process.env.AWS_ENDPOINT_URL ? "true" : "false")) === "true",
  AWS_S3_BUCKET,
  AWS_S3_ACCESS_KEY: process.env.AWS_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY || "",
  AWS_S3_SECRET_KEY: process.env.AWS_S3_SECRET_KEY || process.env.AWS_SECRET_KEY || "",
  S3_BUCKET: AWS_S3_BUCKET,
  THUMBNAILS_S3_BUCKET: process.env.THUMBNAILS_S3_BUCKET || AWS_S3_BUCKET,
  S3_LECTURE_RESOURCES_BUCKET:
    process.env.S3_LECTURE_RESOURCES_BUCKET || AWS_S3_BUCKET,
  TESTIMONIALS_S3_BUCKET: process.env.TESTIMONIALS_S3_BUCKET || AWS_S3_BUCKET,
  // Tenant Details S3 bucket (org logos, favicon, founder photos, certificates)
  TENANT_DETAILS_S3_BUCKET:
    process.env.TENANT_DETAILS_S3_BUCKET || AWS_S3_BUCKET,

  // Tenant Admin Portal URL (for redirect-backs and email links)
  ADMIN_PORTAL_URL: trimSlash(env("ADMIN_URL", "ADMIN_PORTAL_URL") ?? "http://localhost:3610"),

  // Cloudflare (domain management: custom hostnames via Cloudflare for SaaS)
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || "",
  CLOUDFLARE_CNAME_TARGET: process.env.CLOUDFLARE_CNAME_TARGET || "origin.example.com",
  /** Root domain tenant subdomains live under (northwind.lvh.me locally). */
  BASE_DOMAIN: process.env.ROOT_DOMAIN || "lvh.me",
  /** URL scheme for tenant storefront links (http locally, https in production). */
  STOREFRONT_SCHEME: process.env.STOREFRONT_SCHEME || (NODE_ENV === "production" ? "https" : "http"),
  /** Port appended to storefront links in local development (web app on 3620). */
  STOREFRONT_PORT: env("STOREFRONT_PORT", "WEB_PORT") ?? (NODE_ENV === "production" ? "" : "3620"),

  // learner-api base URL (internal service-to-service calls).
  USER_SERVER_BASE_URL: trimSlash(env("LEARNER_API_INTERNAL_URL", "USER_SERVER_BASE_URL") ?? "http://localhost:5096"),

  // Shared secret for internal server-to-server calls (admin-api -> learner-api),
  // e.g. asking learner-api to issue a test certificate the instant an evaluator
  // finishes grading. Set the same INTERNAL_API_KEY on both services.
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || DEV_INTERNAL_API_KEY,

  // Redis Configuration (used by BullMQ for job queues)
  REDIS_HOST: redisUrl?.hostname || (process.env.REDIS_HOST || "localhost"),
  REDIS_PORT: redisUrl?.port || (process.env.REDIS_PORT || "6379"),
  REDIS_USERNAME: redisUrl?.username ? decodeURIComponent(redisUrl.username) : "",
  REDIS_TLS: redisUrl?.protocol === "rediss:" || process.env.REDIS_TLS === "true",
  REDIS_PASSWORD: (redisUrl?.password ? decodeURIComponent(redisUrl.password) : "") || (process.env.REDIS_PASSWORD || ""),
  // Logical database: the REDIS_URL path (redis://host:6379/5) or REDIS_DB.
  REDIS_DB: Number(redisUrl?.pathname.replace(/^\//, "") || process.env.REDIS_DB || 0),
  // BullMQ key prefix; give a test run or a second install its own.
  BULLMQ_PREFIX: process.env.BULLMQ_PREFIX || "bull",

  // Redis pub/sub prefix for cross-API cache busting; must match learner-api.
  CACHE_BUS_PREFIX: process.env.CACHE_BUS_PREFIX || "lms:",

  // AES-256-GCM key that seals tenant payment gateway credentials at rest.
  // Must match learner-api, which reads them.
  CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY || DEV_ENCRYPTION_KEY,

  // Gateway API bases (point at the local stubs in development).
  STRIPE_API_BASE: trimSlash(process.env.STRIPE_API_BASE || "https://api.stripe.com"),
  RAZORPAY_API_BASE: trimSlash(process.env.RAZORPAY_API_BASE || "https://api.razorpay.com"),
  /** Public base of this API, used to show tenants their webhook URLs. */
  PUBLIC_API_BASE_URL: withApiPath(
    process.env.ADMIN_API_PUBLIC_URL,
    trimSlash(process.env.PUBLIC_API_BASE_URL || "http://localhost:5086/api/v1")
  ),
  /** Public base of learner-api, where tenant checkout webhooks land. */
  LEARNER_PUBLIC_API_BASE_URL: withApiPath(
    process.env.LEARNER_API_PUBLIC_URL,
    trimSlash(process.env.LEARNER_PUBLIC_API_BASE_URL || "http://localhost:5096/api/v1")
  ),

  // Platform subscription billing (Stripe + Razorpay). Env PLATFORM_*.
  CORE_RAZORPAY_KEY_ID: env("PLATFORM_RAZORPAY_KEY_ID") ?? "",
  CORE_RAZORPAY_KEY_SECRET: env("PLATFORM_RAZORPAY_KEY_SECRET") ?? "",
  CORE_RAZORPAY_WEBHOOK_SECRET: env("PLATFORM_RAZORPAY_WEBHOOK_SECRET") ?? "",
  CORE_STRIPE_SECRET_KEY: env("PLATFORM_STRIPE_SECRET_KEY") ?? "",
  CORE_STRIPE_WEBHOOK_SECRET: env("PLATFORM_STRIPE_WEBHOOK_SECRET") ?? "",
  CORE_STRIPE_PUBLISHABLE_KEY: env("PLATFORM_STRIPE_PUBLISHABLE_KEY") ?? "",

  // AWS SES (Notification emails)
  AWS_SES_REGION: process.env.AWS_SES_REGION || AWS_REGION,
  AWS_SES_ACCESS_KEY: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_S3_ACCESS_KEY || "",
  AWS_SES_SECRET_KEY: process.env.AWS_SES_SECRET_KEY || process.env.AWS_S3_SECRET_KEY || "",
  SES_FROM_EMAIL: env("AWS_SES_FROM_EMAIL", "SES_FROM_EMAIL") ?? "noreply@example.com",
  SES_FROM_NAME: env("AWS_SES_FROM_NAME", "SES_FROM_NAME", "BRAND_NAME") ?? "Open LMS Cloud",

  // ==========================================================================
  // Email Engine (per-tenant BYO sending domain)
  // ==========================================================================
  // Platform fallback sender, used whenever a tenant has not opted into a
  // custom sending domain or their domain is degraded.
  legacyFromEmail: env("AWS_SES_FROM_EMAIL", "SES_FROM_EMAIL") ?? "noreply@example.com",
  legacyFromName: env("AWS_SES_FROM_NAME", "SES_FROM_NAME", "BRAND_NAME") ?? "Open LMS Cloud",

  // SES event pipeline (SNS topic -> SQS main + DLQ). Created by
  // scripts/email-engine-bootstrap.ts; the SES events consumer no-ops when unset.
  SES_EVENTS_SNS_TOPIC_ARN: process.env.SES_EVENTS_SNS_TOPIC_ARN || "",
  SES_EVENTS_QUEUE_URL: process.env.SES_EVENTS_QUEUE_URL || "",
  SES_EVENTS_DLQ_URL: process.env.SES_EVENTS_DLQ_URL || "",

  // Signing secret for List-Unsubscribe JWT tokens (90d expiry). Must match learner-api.
  EMAIL_UNSUBSCRIBE_SIGNING_SECRET:
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET || process.env.JWT_SECRET || DEV_JWT_SECRET,

  // Send pacing. Per-tenant TPS overridable via tenants.email_tps_override.
  // Exceeding either bucket yields a retryable RATE_LIMITED, so lowering them
  // slows sends but never strands them.
  EMAIL_DEFAULT_TENANT_TPS: parseInt(process.env.EMAIL_DEFAULT_TENANT_TPS || "12", 10),
  EMAIL_ACCOUNT_TPS: parseInt(process.env.EMAIL_ACCOUNT_TPS || "25", 10),

  // Reputation engine tuning.
  EMAIL_REPUTATION_MIN_VOLUME: parseInt(process.env.EMAIL_REPUTATION_MIN_VOLUME || "100", 10),
  EMAIL_REPUTATION_AUTO_RECOVERY_HOURS: parseInt(
    process.env.EMAIL_REPUTATION_AUTO_RECOVERY_HOURS || "48",
    10
  ),

  // OPS alert webhook for SEV1-3 email-engine alerts.
  EMAIL_OPS_ALERT_WEBHOOK_URL: process.env.EMAIL_OPS_ALERT_WEBHOOK_URL || "",

  // ==========================================================================
  // AI authoring (see src/lib/ai/provider.ts)
  // ==========================================================================
  // AI_PROVIDER: "openai" (any OpenAI-compatible API) or "offline"
  // (deterministic output, no network). Defaults to offline when no key is set.
  AI_PROVIDER: (process.env.AI_PROVIDER || (process.env.AI_API_KEY ? "openai" : "offline")).toLowerCase(),
  AI_BASE_URL: trimSlash(process.env.AI_BASE_URL || "https://api.openai.com/v1"),
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_TEXT_MODEL: process.env.AI_TEXT_MODEL || "gpt-4o-mini",
  /** Image model for thumbnails/covers. Image generation is off when unset. */
  AI_IMAGE_MODEL: process.env.AI_IMAGE_MODEL || "",
  AI_REQUEST_TIMEOUT_MS: Number(process.env.AI_REQUEST_TIMEOUT_MS || "120000"),

  // Gates work that spends AI budget with nobody asking for it (onboarding
  // auto-generation, question-bank backfills). Tenant-initiated AI is gated by
  // the ai_authoring_enabled entitlement instead.
  AI_AUTO_GENERATION_ENABLED:
    (process.env.AI_AUTO_GENERATION_ENABLED || "false").toLowerCase() === "true",

  // CloudFront signed URLs (optional)
  CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || "",
  CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID || "",
  CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY || "",

  // Video service (EVS). Lectures store an EVS video id; admin previews mint a
  // playback session. When EVS_API_URL is unset, EVS ids are accepted as-is.
  EVS_API_URL: trimSlash(process.env.EVS_API_URL || ""),
  EVS_API_KEY: process.env.EVS_API_KEY || "",
  EVS_PLAYBACK_TTL_SECONDS: Number(process.env.EVS_PLAYBACK_TTL_SECONDS || "3600"),

  // PostHog query API for the analytics dashboard (optional).
  POSTHOG_HOST: process.env.POSTHOG_HOST || "",
  POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID || "",
  POSTHOG_PERSONAL_API_KEY: process.env.POSTHOG_PERSONAL_API_KEY || "",

  // Brute-force limits on the public staff auth routes (per route, per window).
  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  AUTH_RATE_LIMIT_PER_IP: Number(process.env.AUTH_RATE_LIMIT_PER_IP || 30),
  AUTH_RATE_LIMIT_PER_EMAIL: Number(process.env.AUTH_RATE_LIMIT_PER_EMAIL || 10),

  // OTP settings
  OTP_LENGTH: process.env.OTP_LENGTH || "6",
  OTP_EXPIRY_MINUTES: process.env.OTP_EXPIRY_MINUTES || "15",
  OTP_MAX_ATTEMPTS: process.env.OTP_MAX_ATTEMPTS || "5",

  // console-api (internal service-to-service calls)
  CORE_ADMIN_API_BASE: withApiPath(
    process.env.CONSOLE_API_INTERNAL_URL,
    trimSlash(process.env.CORE_ADMIN_API_BASE || "http://localhost:5076/api/v1")
  ),
  CORE_ADMIN_INTERNAL_SECRET: process.env.CORE_ADMIN_INTERNAL_SECRET || "",
  CORE_ADMIN_BASE_URL: trimSlash(env("CONSOLE_URL", "CORE_ADMIN_BASE_URL") ?? "http://localhost:3600"),

  // Exchange rates
  OPEN_EXCHANGE_RATES_API_KEY: process.env.OPEN_EXCHANGE_RATES_API_KEY || "",

  // Fixed USD to INR conversion rate used for the "Combined Revenue"
  // normalization shown in the admin dashboard and analytics pages.
  // Display-only, see utils/currency.util.ts.
  USD_TO_INR_RATE: process.env.USD_TO_INR_RATE || "90",
};

/**
 * Refuses to boot in production with local-only secrets. Called at startup.
 */
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
  if (c.INTERNAL_API_KEY === DEV_INTERNAL_API_KEY || c.INTERNAL_API_KEY.length < 32) {
    problems.push("INTERNAL_API_KEY must be set to a random value of at least 32 characters");
  }
  if (c.CORS_ORIGINS.length === 0) {
    problems.push("CORS_ORIGINS must list the admin portal origin(s)");
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join("\n  - ")}`);
  }
}

export default config;

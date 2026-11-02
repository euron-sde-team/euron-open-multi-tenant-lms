/**
 * Stub settings. Every secret below is a visibly fake local value: the stubs stand in for
 * Stripe, Razorpay, EVS and an OpenAI-compatible API on a laptop or in CI, never in front
 * of real money or real data.
 */
const env = process.env;
const trim = (u: string) => u.replace(/\/+$/, "");

export const config = {
  port: Number(env.PORT ?? 5189),
  host: env.HOST ?? "0.0.0.0",
  /** Base URL a browser uses to reach the stubs (hosted checkout pages, HLS manifests). */
  publicUrl: trim(env.STUBS_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 5189}`),

  /** Where webhooks go. Inside compose these are the service names. */
  learnerApiUrl: trim(env.STUBS_LEARNER_API_URL ?? "http://localhost:5096"),
  adminApiUrl: trim(env.STUBS_ADMIN_API_URL ?? "http://localhost:5086"),
  learnerStripeWebhookPath: env.STUBS_LEARNER_STRIPE_WEBHOOK_PATH ?? "/api/v1/webhooks/stripe",
  learnerRazorpayWebhookPath: env.STUBS_LEARNER_RAZORPAY_WEBHOOK_PATH ?? "/api/v1/webhooks/razorpay",
  adminStripeWebhookPath: env.STUBS_ADMIN_STRIPE_WEBHOOK_PATH ?? "/api/v1/webhook/stripe/subscription",
  adminRazorpayWebhookPath: env.STUBS_ADMIN_RAZORPAY_WEBHOOK_PATH ?? "/api/v1/webhook/razorpay/subscription",

  /** Signs every Stripe webhook the stub sends (tenant and platform alike). */
  stripeWebhookSecret: env.STUBS_STRIPE_WEBHOOK_SECRET ?? "whsec_stub_local_only",
  /** Signs every Razorpay webhook the stub sends. */
  razorpayWebhookSecret: env.STUBS_RAZORPAY_WEBHOOK_SECRET ?? "rzp_whsec_stub_local_only",
  /**
   * Requests authenticated with these keys are platform billing (operator charging a
   * tenant): their webhooks go to admin-api. Every other key is a tenant's gateway
   * account selling to learners: its webhooks go to learner-api.
   */
  platformStripeSecretKey: env.STUBS_PLATFORM_STRIPE_SECRET_KEY ?? "sk_test_stub_platform",
  platformRazorpayKeyId: env.STUBS_PLATFORM_RAZORPAY_KEY_ID ?? "rzp_test_stubplatform",

  /** EVS: when set, playback-session calls must carry `Authorization: Bearer <key>`. */
  evsApiKey: env.STUBS_EVS_API_KEY ?? "",
  /** EVS: serve this manifest instead of the bundled sample (e.g. a public test stream). */
  hlsManifestUrl: env.STUBS_HLS_MANIFEST_URL ?? "",

  /** OpenAI-compatible: when set, chat completions must carry `Authorization: Bearer <key>`. */
  aiApiKey: env.STUBS_AI_API_KEY ?? "",
};

export type StubConfig = typeof config;

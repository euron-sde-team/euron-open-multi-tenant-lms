import Razorpay from "razorpay";
import config from "../../config";

/**
 * Gateway API base URLs come from env (RAZORPAY_API_BASE, STRIPE_API_BASE) so
 * the local stubs can stand in for the real providers. Unset = the real API.
 */

/** A Razorpay client pointed at RAZORPAY_API_BASE when set. */
export function createRazorpayClient(keyId: string, keySecret: string): Razorpay {
  const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  if (config.RAZORPAY_API_BASE) {
    // The SDK hard-codes its host; its axios instance is the only override point.
    const api = (instance as unknown as { api?: { rq?: { defaults: { baseURL?: string } } } }).api;
    if (api?.rq) api.rq.defaults.baseURL = config.RAZORPAY_API_BASE;
  }
  return instance;
}

/** Stripe client host options derived from STRIPE_API_BASE (empty when unset). */
export function stripeHostOptions(): { host?: string; port?: number; protocol?: "http" | "https" } {
  if (!config.STRIPE_API_BASE) return {};
  const url = new URL(config.STRIPE_API_BASE);
  const protocol = url.protocol === "http:" ? "http" : "https";
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : protocol === "http" ? 80 : 443,
    protocol,
  };
}

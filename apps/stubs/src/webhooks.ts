/**
 * Webhook delivery: POSTs a signed event to an API and keeps the last 100 attempts for
 * GET /__stubs/webhooks, so a failed fulfilment can be diagnosed without reading logs.
 */
export interface Delivery {
  at: string;
  provider: "stripe" | "razorpay";
  event: string;
  url: string;
  status: number | null;
  response: string;
}

const deliveries: Delivery[] = [];

export function recentDeliveries(): Delivery[] {
  return [...deliveries].reverse();
}

export async function deliver(
  provider: Delivery["provider"],
  event: string,
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<Delivery> {
  const entry: Delivery = { at: new Date().toISOString(), provider, event, url, status: null, response: "" };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": `${provider}-stub/1.0`, ...headers },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    entry.status = r.status;
    entry.response = (await r.text()).slice(0, 500);
  } catch (err) {
    entry.response = err instanceof Error ? err.message : String(err);
  }
  deliveries.push(entry);
  if (deliveries.length > 100) deliveries.shift();
  console.log(`[stubs] ${provider} webhook ${event} -> ${url}: ${entry.status ?? "unreachable"} ${entry.status && entry.status < 300 ? "" : entry.response}`);
  return entry;
}

/**
 * Reputation metrics: Redis-backed rolling 14-day window of per-tenant
 * email events.
 *
 * Storage: one Redis sorted set per (tenantId, eventType), scored by
 * timestamp. Members are unique event ids (SES feedbackId or our message id +
 * suffix). On every write we prune entries older than 14 days.
 *
 * Keys: `email-rep:{tenantId}:{eventType}` where eventType is one of:
 *   sent | delivered | bounced_perm | bounced_trans | complained | opened | clicked
 *
 * Phase 7 writes here on every SES event. Phase 8 reads here in the
 * enforcer's getRates() to compute permanent-bounce-rate / complaint-rate /
 * delivery-rate over the rolling window.
 */

import { getRedisClient } from "../../lib/redis";
import logger from "../../utils/logger";

export type ReputationEventType =
  | "sent"
  | "delivered"
  | "bounced_perm"
  | "bounced_trans"
  | "complained"
  | "opened"
  | "clicked";

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function key(tenantId: string, type: ReputationEventType): string {
  return `email-rep:${tenantId}:${type}`;
}

/**
 * Record one event for a tenant. Idempotent via the `eventId` set member.
 * the same SES event delivered twice (SQS at-least-once) writes once.
 *
 * Fire-and-forget pattern: callers should NOT await the result on the hot
 * path; failure to record a metric must never abort the broader event
 * processing pipeline (delivery / suppression / etc. take precedence).
 * Errors are swallowed + logged.
 */
export async function recordReputationEvent(
  tenantId: string,
  type: ReputationEventType,
  eventId: string,
  timestamp: number = Date.now(),
): Promise<void> {
  try {
    const client = await getRedisClient();
    const k = key(tenantId, type);
    // ZADD with NX: only insert if not already present (idempotent under
    // duplicate SQS deliveries).
    await client.zAdd(k, { score: timestamp, value: eventId }, { NX: true });
    // Prune entries older than 14d on every write. Cheap (range scan on
    // score). No separate sweep job needed.
    const cutoff = Date.now() - WINDOW_MS;
    await client.zRemRangeByScore(k, 0, cutoff);
  } catch (err) {
    logger.warn(
      `[reputation-metrics] recordReputationEvent failed tenant=${tenantId} type=${type}: ${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Read-side: rates for the enforcer (Phase 8)
// ---------------------------------------------------------------------------

export interface ReputationRates {
  /** Window bounds for transparency. */
  windowStart: Date;
  windowEnd: Date;
  /** Raw counts. */
  sent: number;
  delivered: number;
  bouncedPerm: number;
  bouncedTrans: number;
  complained: number;
  opened: number;
  clicked: number;
  /** Derived percentages, 0..1. Zero when denominator is zero. */
  permBounceRate: number;
  complaintRate: number;
  deliveryRate: number;
  openRate: number;
}

/**
 * Read all reputation metrics for a tenant over the rolling window.
 *
 * Callers (the enforcer, the tenant-facing read endpoint) use this to drive
 * status transitions. Uses ZCOUNT for each event type which is O(log N) on
 * the sorted set; total cost is 7 ZCOUNT calls per tenant per evaluation.
 */
export async function getRates(
  tenantId: string,
  windowMs: number = WINDOW_MS,
): Promise<ReputationRates> {
  const now = Date.now();
  const cutoff = now - windowMs;

  const counts = await readCounts(tenantId, cutoff);
  const sent = counts.sent;
  const delivered = counts.delivered;

  return {
    windowStart: new Date(cutoff),
    windowEnd: new Date(now),
    sent,
    delivered,
    bouncedPerm: counts.bouncedPerm,
    bouncedTrans: counts.bouncedTrans,
    complained: counts.complained,
    opened: counts.opened,
    clicked: counts.clicked,
    permBounceRate: sent > 0 ? counts.bouncedPerm / sent : 0,
    complaintRate: sent > 0 ? counts.complained / sent : 0,
    deliveryRate: sent > 0 ? delivered / sent : 0,
    openRate: delivered > 0 ? counts.opened / delivered : 0,
  };
}

async function readCounts(
  tenantId: string,
  cutoff: number,
): Promise<{
  sent: number;
  delivered: number;
  bouncedPerm: number;
  bouncedTrans: number;
  complained: number;
  opened: number;
  clicked: number;
}> {
  const empty = {
    sent: 0,
    delivered: 0,
    bouncedPerm: 0,
    bouncedTrans: 0,
    complained: 0,
    opened: 0,
    clicked: 0,
  };
  try {
    const client = await getRedisClient();
    const [
      sent,
      delivered,
      bouncedPerm,
      bouncedTrans,
      complained,
      opened,
      clicked,
    ] = await Promise.all([
      client.zCount(key(tenantId, "sent"), cutoff, "+inf"),
      client.zCount(key(tenantId, "delivered"), cutoff, "+inf"),
      client.zCount(key(tenantId, "bounced_perm"), cutoff, "+inf"),
      client.zCount(key(tenantId, "bounced_trans"), cutoff, "+inf"),
      client.zCount(key(tenantId, "complained"), cutoff, "+inf"),
      client.zCount(key(tenantId, "opened"), cutoff, "+inf"),
      client.zCount(key(tenantId, "clicked"), cutoff, "+inf"),
    ]);
    return {
      sent: Number(sent),
      delivered: Number(delivered),
      bouncedPerm: Number(bouncedPerm),
      bouncedTrans: Number(bouncedTrans),
      complained: Number(complained),
      opened: Number(opened),
      clicked: Number(clicked),
    };
  } catch (err) {
    logger.warn(
      `[reputation-metrics] getRates Redis read failed tenant=${tenantId}: ${(err as Error).message}`,
    );
    return empty;
  }
}

/**
 * Resolver, pick the right FROM identity for (tenantId, category).
 *
 * Returns one of:
 *   - { mode: "custom", ... }  if the tenant has a VERIFIED sending domain
 *                              AND a default identity for the given category.
 *   - { mode: "legacy", ... }  in every other case (no domain, domain not
 *                              VERIFIED, no default identity, identity on a
 *                              non-VERIFIED domain).
 *
 * Caller contract on { mode: "legacy" }:
 *   The existing legacy SES path MUST continue, with the FROM line formatted
 *   as `"{tenantName} <{config.legacyFromEmail}>"`. The tenant's
 *   organization name MUST appear in the FROM display name, only the email
 *   address falls back to the platform's noreply@example.com.
 *
 * Caching: 60s TTL in Redis keyed by (tenantId, category, identityOverrideId).
 * On any mutation to a sending domain or sender identity, the service code
 * MUST call `invalidate(tenantId)` to clear this tenant's cache entries.
 * The 60s TTL is the upper bound for staleness even if invalidate() is missed.
 */

import { db } from "../../db/connection";
import { getRedisClient } from "../../lib/redis";
import logger from "../../utils/logger";
import type { TenantSendingStatus } from "./category-gate";

export interface ResolvedCustomSender {
  mode: "custom";
  domainId: string;
  identityId: string;
  fromAddress: string;
  displayName: string | null;
  /**
   * Tenant organization name (from `tenants.name`). Used by the sender as a
   * guaranteed FROM display-name fallback so an email never lands with a
   * bare email address as its FROM line, matching the legacy
   * `"{tenantName} <noreply@example.com>"` behavior.
   */
  tenantName: string;
  replyTo: string | null;
  configurationSetName: string;
  tenantSendingStatus: TenantSendingStatus;
}

export interface ResolvedLegacy {
  mode: "legacy";
  tenantSendingStatus: TenantSendingStatus;
  reason:
    | "TENANT_NOT_FOUND"
    | "NO_VERIFIED_DOMAIN"
    | "NO_DEFAULT_IDENTITY"
    | "IDENTITY_DOMAIN_UNVERIFIED";
}

export type ResolveResult = ResolvedCustomSender | ResolvedLegacy;

export type Category = "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING";

export interface ResolveOptions {
  /**
   * Override the per-category default with a specific identity id (e.g. when
   * a campaign explicitly picks `marketing-summer@hello.example.org` instead of
   * the tenant's MARKETING default).
   */
  identityOverrideId?: string;
}

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = "email-resolver";

function cacheKey(
  tenantId: string,
  category: Category,
  identityOverrideId: string | undefined,
): string {
  return `${CACHE_PREFIX}:${tenantId}:${category}:${identityOverrideId ?? "default"}`;
}

function defaultColumnFor(
  category: Category,
):
  | "is_default_transactional"
  | "is_default_notification"
  | "is_default_marketing" {
  switch (category) {
    case "TRANSACTIONAL":
      return "is_default_transactional";
    case "NOTIFICATION":
      return "is_default_notification";
    case "MARKETING":
      return "is_default_marketing";
  }
}

export async function resolveSender(
  tenantId: string,
  category: Category,
  opts: ResolveOptions = {},
): Promise<ResolveResult> {
  const key = cacheKey(tenantId, category, opts.identityOverrideId);

  try {
    const client = await getRedisClient();
    const cached = await client.get(key);
    if (cached) {
      return JSON.parse(cached) as ResolveResult;
    }
  } catch (err) {
    logger.warn(
      `[email-resolver] cache read failed: ${(err as Error).message}`,
    );
  }

  const result = await resolveFromDb(
    tenantId,
    category,
    opts.identityOverrideId,
  );

  try {
    const client = await getRedisClient();
    await client.set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.warn(
      `[email-resolver] cache write failed: ${(err as Error).message}`,
    );
  }

  return result;
}

async function resolveFromDb(
  tenantId: string,
  category: Category,
  identityOverrideId: string | undefined,
): Promise<ResolveResult> {
  const tenant = await db
    .selectFrom("tenants")
    .select(["id", "name", "email_sending_status"])
    .where("id", "=", tenantId)
    .executeTakeFirst();

  // Missing tenant means signups racing the resolver, or test setup. Falling
  // back to legacy keeps the send flowing rather than throwing on a benign
  // race. The caller will route to the platform legacy FROM.
  if (!tenant) {
    return {
      mode: "legacy",
      tenantSendingStatus: "ACTIVE",
      reason: "TENANT_NOT_FOUND",
    };
  }
  const tenantSendingStatus = tenant.email_sending_status;

  // Locate the identity: explicit override OR per-category default.
  const identityQuery = db
    .selectFrom("tenant_email_sender_identities")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("status", "=", "ACTIVE");
  const identityRow = identityOverrideId
    ? await identityQuery.where("id", "=", identityOverrideId).executeTakeFirst()
    : await identityQuery
        .where(defaultColumnFor(category), "=", true)
        .executeTakeFirst();

  if (!identityRow) {
    return {
      mode: "legacy",
      tenantSendingStatus,
      reason: "NO_DEFAULT_IDENTITY",
    };
  }

  // The parent domain MUST still be VERIFIED at send time; we don't trust the
  // identity row alone (an admin may have just deleted the domain).
  const domain = await db
    .selectFrom("tenant_email_sending_domains")
    .selectAll()
    .where("id", "=", identityRow.sending_domain_id)
    .executeTakeFirst();
  if (!domain) {
    return {
      mode: "legacy",
      tenantSendingStatus,
      reason: "NO_VERIFIED_DOMAIN",
    };
  }
  if (domain.status !== "VERIFIED") {
    return {
      mode: "legacy",
      tenantSendingStatus,
      reason: "IDENTITY_DOMAIN_UNVERIFIED",
    };
  }

  return {
    mode: "custom",
    domainId: domain.id,
    identityId: identityRow.id,
    fromAddress: identityRow.email_address,
    displayName: identityRow.display_name,
    tenantName: (tenant.name ?? "").trim(),
    replyTo: identityRow.reply_to,
    configurationSetName: domain.ses_configuration_set,
    tenantSendingStatus,
  };
}

/**
 * Drop every cached resolver entry for the given tenant.
 *
 * Called by services that mutate the sending domain or sender identity rows:
 *   - email-sending-domain.service: onboard, verify-transition, delete
 *   - email-sender-identity.service: create, update, archive
 *
 * Cache keys are small (max ~6 per tenant: 3 categories x small override set),
 * so SCAN with COUNT=100 is more than enough in a single iteration.
 */
export async function invalidate(tenantId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    let cursor = "0";
    do {
      const result = await client.scan(cursor, {
        MATCH: `${CACHE_PREFIX}:${tenantId}:*`,
        COUNT: 100,
      });
      cursor = String(result.cursor);
      if (result.keys.length > 0) {
        await client.del(result.keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    logger.warn(
      `[email-resolver] cache invalidation failed for tenant=${tenantId}: ${(err as Error).message}`,
    );
  }
}

import { getRedisClient } from "../lib/redis";
import { db } from "../db/connection";
import logger from "../utils/logger";
import config from "../config";
import { s3PublicUrl } from "../utils/s3";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TenantOrgContext {
  tenantName: string;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  yearEstablished: number | null;
  founderName: string | null;
  founderTitle: string | null;
  contactEmail: string | null;
  supportEmail: string | null;
  phoneNumbers: string[] | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  socialLinks: {
    website?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
  } | null;
  legalEntityName: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoLightKey: string | null;
}

// ─── Cache Constants ────────────────────────────────────────────────────────

const L1_TTL_MS = 60_000; // 60 seconds
const L2_TTL_SECONDS = 300; // 5 minutes
const REDIS_KEY_PREFIX = "ai:org-context:";

// ─── L1 In-Memory Cache (per worker) ───────────────────────────────────────

interface L1Entry {
  data: TenantOrgContext;
  expiresAt: number;
}

const l1Cache = new Map<string, L1Entry>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildS3Url(key: string | null): string | null {
  if (!key) return null;
  return s3PublicUrl(config.TENANT_DETAILS_S3_BUCKET, key);
}

// ─── Cache Service ──────────────────────────────────────────────────────────

class TenantOrgContextCache {
  /**
   * Get org context for a tenant. Two-tier: L1 (in-memory) → L2 (Redis) → DB.
   */
  async get(tenantId: string): Promise<TenantOrgContext> {
    // L1 check
    const l1 = l1Cache.get(tenantId);
    if (l1 && l1.expiresAt > Date.now()) {
      return l1.data;
    }

    // L2 check (Redis)
    try {
      const client = await getRedisClient();
      const raw = await client.get(`${REDIS_KEY_PREFIX}${tenantId}`);
      if (raw) {
        const data = JSON.parse(raw) as TenantOrgContext;
        l1Cache.set(tenantId, { data, expiresAt: Date.now() + L1_TTL_MS });
        return data;
      }
    } catch (err) {
      logger.warn("[org-context-cache] Redis get failed:", err);
    }

    // DB fetch
    const context = await this.fetchFromDb(tenantId);

    // Populate caches
    l1Cache.set(tenantId, { data: context, expiresAt: Date.now() + L1_TTL_MS });
    try {
      const client = await getRedisClient();
      await client.setEx(
        `${REDIS_KEY_PREFIX}${tenantId}`,
        L2_TTL_SECONDS,
        JSON.stringify(context)
      );
    } catch (err) {
      logger.warn("[org-context-cache] Redis set failed:", err);
    }

    return context;
  }

  /**
   * Invalidate cached org context for a tenant.
   */
  async invalidate(tenantId: string): Promise<void> {
    l1Cache.delete(tenantId);
    try {
      const client = await getRedisClient();
      await client.del(`${REDIS_KEY_PREFIX}${tenantId}`);
    } catch (err) {
      logger.warn("[org-context-cache] Redis invalidate failed:", err);
    }
  }

  private async fetchFromDb(tenantId: string): Promise<TenantOrgContext> {
    // Fetch tenant name
    const tenant = await db
      .selectFrom("tenants")
      .select(["name"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    // Fetch org details
    const org = await db
      .selectFrom("tenant_org_details")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    const tenantName = tenant?.name ?? "Our Company";

    if (!org) {
      return {
        tenantName,
        tagline: null,
        description: null,
        industry: null,
        yearEstablished: null,
        founderName: null,
        founderTitle: null,
        contactEmail: null,
        supportEmail: null,
        phoneNumbers: null,
        address: null,
        socialLinks: null,
        legalEntityName: null,
        logoLightUrl: null,
        logoDarkUrl: null,
        logoLightKey: null,
      };
    }

    return {
      tenantName,
      tagline: org.tagline ?? null,
      description: org.description ?? null,
      industry: org.industry ?? null,
      yearEstablished: org.year_established
        ? typeof org.year_established === "string"
          ? parseInt(org.year_established, 10)
          : Number(org.year_established)
        : null,
      founderName: org.founder_name ?? null,
      founderTitle: org.founder_title ?? null,
      contactEmail: org.contact_email ?? null,
      supportEmail: org.support_email ?? null,
      phoneNumbers: org.phone_numbers as string[] | null,
      address: org.address as TenantOrgContext["address"],
      socialLinks: org.social_links as TenantOrgContext["socialLinks"],
      legalEntityName: org.legal_entity_name ?? null,
      logoLightUrl: buildS3Url(org.logo_light_key ?? null),
      logoDarkUrl: buildS3Url(org.logo_dark_key ?? null),
      logoLightKey: org.logo_light_key ?? null,
    };
  }
}

const tenantOrgContextCache = new TenantOrgContextCache();
export default tenantOrgContextCache;

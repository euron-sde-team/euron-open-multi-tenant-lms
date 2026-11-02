import { db } from "../db/connection";
import { buildDisplayName } from "./display-name.util";

const CACHE_TTL_MS = 30 * 1000;

type CacheEntry = { name: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();

/**
 * Resolve an authenticated member's display name for use as `fullName` on
 * BBB join URLs. Reads from `tenant_members.name`, falls back to email
 * local-part, then "User". Cached briefly to avoid a DB hit on every join.
 */
export async function resolveMemberDisplayName(args: {
  tenantId: string;
  memberId: string;
  fallbackEmail?: string | null;
}): Promise<string> {
  const cacheKey = `${args.tenantId}:${args.memberId}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.name;

  const row = await db
    .selectFrom("tenant_members")
    .select(["name", "email"])
    .where("id", "=", args.memberId)
    .where("tenant_id", "=", args.tenantId)
    .limit(1)
    .executeTakeFirst();

  const name = buildDisplayName({
    name: row?.name,
    email: row?.email ?? args.fallbackEmail ?? null,
  });

  cache.set(cacheKey, { name, expiresAt: now + CACHE_TTL_MS });
  return name;
}

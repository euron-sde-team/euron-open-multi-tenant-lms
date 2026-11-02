import { Request } from "express";
import { ulid } from "ulid";

import tenantAuditRepository, {
  type AuditLogFilters,
  type AuditLogRow,
} from "../repositories/tenant-audit.repository";
import logger from "../utils/logger";
import { getCapability } from "../capabilities";
import { db } from "../db/connection";
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditContext,
} from "./audit-actions";

/** Never write these into `metadata`, whatever the route sends. */
const SECRET_KEYS = [
  "password",
  "newPassword",
  "currentPassword",
  "tempPassword",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "secretKey",
  "apiKey",
  "clientSecret",
  "authProviderToken",
  "privateKey",
];

export interface RecordParams {
  tenantId: string;
  actor: {
    id: string | null;
    email: string | null;
    name: string | null;
  };
  action: string;
  category: string;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
  /** The line a human reads. Already includes the actor's name. */
  summary: string;
  metadata?: Record<string, unknown> | null;
  /** false = the action was blocked. */
  succeeded?: boolean;
  request?: Request;
  /** For callers with no `request` to read them from, the login service. */
  ip?: string | null;
  userAgent?: string | null;
}

class TenantAuditService {
  /**
   * Append one entry.
   *
   * NEVER throws. A failed audit write must not turn a successful course
   * publish into a 500, the user did the thing; we just failed to write it
   * down. We log loudly instead so the gap is visible in CloudWatch.
   */
  async record(params: RecordParams): Promise<void> {
    try {
      const ua = params.request?.get("user-agent") ?? params.userAgent ?? null;

      await tenantAuditRepository.create({
        id: ulid(),
        tenant_id: params.tenantId,
        actor_user_id: params.actor.id,
        actor_email: params.actor.email,
        actor_name: params.actor.name,
        action: params.action,
        category: params.category,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        resource_label: params.resourceLabel ?? null,
        summary: params.summary,
        metadata: params.metadata ? redact(params.metadata) : null,
        succeeded: params.succeeded ?? true,
        ip_address: params.request
          ? clientIp(params.request)
          : (params.ip ?? null),
        user_agent: ua,
        device: ua ? deviceOf(ua) : null,
        browser: ua ? browserOf(ua) : null,
        os: ua ? osOf(ua) : null,
      });
    } catch (err) {
      logger.error("Failed to write tenant audit log", {
        error: err instanceof Error ? err.message : String(err),
        tenantId: params.tenantId,
        action: params.action,
      });
    }
  }

  /** Build the summary line from a registry entry: "Priya published the course X". */
  buildSummary(
    action: AuditAction,
    actorName: string | null,
    resourceLabel: string | null,
    succeeded: boolean,
    ctx?: AuditContext
  ): string {
    const who = actorName ?? "Someone";

    if (succeeded) {
      return `${who} ${action.summary(resourceLabel, ctx)}`;
    }

    // A denial reads as an attempt, not as a fact, and "tried to created the
    // role" is not English. Registry entries carry a bare infinitive for exactly
    // this; fall back to the past tense only if one wasn't declared.
    const what = (action.attempt ?? action.summary)(resourceLabel, ctx);
    return `${who} tried to ${what}, denied`;
  }

  /**
   * Turn the ids a request carries into display names, so an entry can say
   * "set Afeefa Sheikh's roles to Educator and Finance".
   *
   * Only runs for actions that declared `resolve`, one or two small indexed
   * lookups, and only AFTER the response has been sent, so it costs the user
   * nothing. Failure is silent: a missing name degrades the sentence, it does
   * not lose the entry.
   */
  async resolveNames(
    tenantId: string,
    action: AuditAction,
    req: Request
  ): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    if (!action.resolve) return names;

    /** Pull ids out of the URL params or the body, whichever holds them. */
    const idsFor = (keys: string[]): string[] => {
      const out: string[] = [];
      for (const k of keys) {
        const fromParams = (req.params as Record<string, string>)?.[k];
        if (fromParams) out.push(fromParams);
        const fromBody = (req.body as Record<string, unknown>)?.[k];
        if (typeof fromBody === "string") out.push(fromBody);
        else if (Array.isArray(fromBody)) {
          for (const v of fromBody) if (typeof v === "string") out.push(v);
        }
      }
      return [...new Set(out)];
    };

    try {
      const userIds = idsFor(action.resolve.users ?? []);
      if (userIds.length) {
        const rows = await db
          .selectFrom("tenant_users")
          .select(["id", "name", "email"])
          .where("id", "in", userIds)
          .execute();
        for (const r of rows) names[r.id] = r.name || r.email || "someone";
      }

      // Capability ids are OUR vocabulary ("courses.publish"). The whole point
      // of this project was to stop showing those to tenants, so turn them into
      // the sentence the admin actually ticked.
      for (const id of idsFor(action.resolve.capabilities ?? [])) {
        const cap = getCapability(id);
        if (cap) names[id] = cap.label;
      }

      const roleIds = idsFor(action.resolve.roles ?? []);
      if (roleIds.length) {
        // Tenant-scoped, like every other role read: a template (tenant_id NULL)
        // is shared, a custom role belongs to exactly one tenant.
        const rows = await db
          .selectFrom("tenant_roles")
          .select(["id", "name"])
          .where("id", "in", roleIds)
          .where((eb) =>
            eb.or([
              eb("tenant_id", "=", tenantId),
              eb("tenant_id", "is", null),
            ])
          )
          .execute();
        for (const r of rows) names[r.id] = r.name;
      }
    } catch (err) {
      logger.warn("Audit: could not resolve names for entry", {
        action: action.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return names;
  }

  /**
   * Read a row so we can diff against it after the write.
   *
   * WHY: an edit PUTs the WHOLE object. Changing one price sends title, prices,
   * duration, language, prerequisites, learning outcomes, sixteen fields, and
   * logging the body meant the entry claimed all sixteen changed. The only
   * honest answer to "what changed?" is before-vs-after.
   *
   * Best-effort: if we can't read it, we log the action without a diff rather
   * than lose the entry.
   */
  async snapshot(
    table: string,
    id: string,
    tenantId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const row = await db
        .selectFrom(table as never)
        .selectAll()
        .where("id" as never, "=", id as never)
        .where("tenant_id" as never, "=", tenantId as never)
        .executeTakeFirst();
      return (row as Record<string, unknown>) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * A staff member signed in. Written into EVERY organisation they belong to:
   * each owner should see when their own team came in, and a sign-in isn't
   * tied to one org until the person picks one.
   */
  async recordLogin(params: {
    tenantIds: string[];
    actor: RecordParams["actor"];
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const action = AUDIT_ACTIONS["POST /auth/login"];
    await Promise.all(
      params.tenantIds.map((tenantId) =>
        this.record({
          tenantId,
          actor: params.actor,
          action: action.action,
          category: action.category,
          resourceType: action.resourceType ?? null,
          resourceId: params.actor.id,
          resourceLabel: params.actor.name ?? params.actor.email,
          summary: this.buildSummary(action, params.actor.name, null, true),
          ip: params.ip,
          userAgent: params.userAgent,
        })
      )
    );
  }

  /**
   * Someone opened a dashboard page their role doesn't include, and the
   * portal's route guard turned them away. Logged as a blocked attempt.
   *
   * The actor is always the authenticated caller, so the worst a person can do
   * with this endpoint is accuse themselves. One entry per person per page per
   * 10 minutes: a refresh or a second tab is not a second attempt.
   */
  async recordDeniedView(params: {
    tenantId: string;
    actor: RecordParams["actor"];
    path: string;
    label: string | null;
    request: Request;
  }): Promise<void> {
    const action = AUDIT_ACTIONS["VIEW /denied-page"];
    if (
      params.actor.id &&
      (await this.recentlyRecorded({
        tenantId: params.tenantId,
        actorUserId: params.actor.id,
        action: action.action,
        resourceId: params.path,
        withinMs: 10 * 60 * 1000,
        succeeded: false,
      }))
    ) {
      return;
    }

    await this.record({
      tenantId: params.tenantId,
      actor: params.actor,
      action: action.action,
      category: action.category,
      resourceType: action.resourceType ?? null,
      resourceId: params.path,
      resourceLabel: params.label,
      summary: this.buildSummary(action, params.actor.name, params.label, false),
      metadata: { denied: true, page: params.path },
      succeeded: false,
      request: params.request,
    });
  }

  /** Did this person already log this action on this thing in the window? */
  async recentlyRecorded(params: {
    tenantId: string;
    actorUserId: string;
    action: string;
    resourceId: string | null;
    withinMs: number;
    succeeded?: boolean;
  }): Promise<boolean> {
    try {
      return await tenantAuditRepository.existsSince({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        resourceId: params.resourceId,
        since: new Date(Date.now() - params.withinMs),
        succeeded: params.succeeded,
      });
    } catch {
      // Can't tell, write the entry. A duplicate line beats a missing one.
      return false;
    }
  }

  async list(
    filters: AuditLogFilters
  ): Promise<{ logs: AuditLogRow[]; total: number }> {
    const [logs, total] = await Promise.all([
      tenantAuditRepository.list(filters),
      tenantAuditRepository.count(filters),
    ]);
    return { logs, total };
  }

  /** Everyone who appears in this tenant's log, for the "person" filter. */
  async listActors(tenantId: string) {
    return tenantAuditRepository.listActors(tenantId);
  }

  /** The modules and actions present in the registry, for the filter dropdowns. */
  getFilterOptions(): {
    categories: string[];
    actions: { action: string; category: string }[];
  } {
    const actions = Object.values(AUDIT_ACTIONS).map((a) => ({
      action: a.action,
      category: a.category,
    }));
    const categories = [...new Set(actions.map((a) => a.category))].sort();
    return { categories, actions };
  }

  /** Retention. Called by the daily job. */
  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await tenantAuditRepository.deleteOlderThan(cutoff);
    if (deleted > 0) {
      logger.info(`Audit retention: removed ${deleted} entries older than ${days}d`);
    }
    return deleted;
  }
}

/**
 * Strip anything secret before it reaches the database. An audit log that
 * records the payment-gateway key it just watched someone set is a liability,
 * not a control. Recursive: secrets hide inside nested objects.
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (SECRET_KEYS.some((s) => lower.includes(s.toLowerCase()))) {
      out[k] = "[redacted]";
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

function clientIp(req: Request): string | null {
  const fwd = req.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip ?? null;
}

// Deliberately crude. This exists so the owner can spot "that login was from a
// phone in a browser I don't recognise", not to fingerprint anyone.
function deviceOf(ua: string): string {
  if (/mobile|iphone|android/i.test(ua)) return "Mobile";
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}

function browserOf(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Unknown";
}

function osOf(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
}

export default new TenantAuditService();

import { NextFunction, Request, Response } from "express";

import {
  DOMAINS,
  lookupAuditAction,
  type AuditAction,
  type AuditContext,
} from "../services/audit-actions";
import tenantAuditService from "../services/tenant-audit.service";
import { db } from "../db/connection";

/**
 * Records what each admin does, without touching a single controller.
 *
 * WHY A MIDDLEWARE AND NOT `auditService.record()` IN EVERY SERVICE
 * ----------------------------------------------------------------
 * The actor lives on `req` (controllers see it; services don't, 90 uses vs 2).
 * Threading `req.tenantUser` down into every service to write a log line would
 * mean touching hundreds of call-sites and would rot the moment someone forgot.
 * Mounting once, above the routes, means a new feature is audited by adding a
 * line to the registry, not by remembering to instrument it.
 *
 * HOW IT NAMES THINGS
 * -------------------
 * "Priya published the course 'Python Masterclass'" needs the course's NAME,
 * which the request doesn't carry, only its id. So we let the request run,
 * intercept the response body, and take the name from there. Nothing is written
 * until we know the action actually succeeded.
 *
 * SAFETY
 * ------
 * - Reads only. It never blocks, delays, or fails a request: the log is written
 *   after the response is sent, and the service swallows its own errors.
 * - GETs are skipped, reading isn't an event.
 * - Unregistered routes are NOT skipped: the registry names the ~34 actions
 *   worth a hand-written sentence, and `deriveAuditAction()` covers the other
 *   ~500 from the shape of the route. A new feature is therefore logged the day
 *   it ships, whether or not anyone remembered to name it.
 */
export function auditLog() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Reading isn't an action. Only writes get logged.
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }

    // A dry run is a preview: it changes nothing, so it isn't an action either.
    // The assistant previews every page template before applying it, and
    // without this each preview read "applied a design template to a page".
    if (isDryRun(req)) return next();

    // Resolve the route pattern, "/courses/:id/publish", not the concrete URL,
    // so the registry key is stable regardless of which course it was.
    // `req.route` isn't populated until the route matches, so this runs in the
    // `finish` handler below, not here.
    let captured: unknown;
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      captured = body;
      return originalJson(body);
    };

    // Two things must be captured BEFORE the handler runs, because the handler
    // destroys them:
    //
    //   1. A DELETE removes the very row whose name we want to print.
    //   2. An edit overwrites the row we need to diff against, and an edit PUTs
    //      the WHOLE object, so without a "before" the log claims every field
    //      changed when the user only touched one price.
    //
    // Both are best-effort and fire-and-forget: a failed capture costs us a
    // detail, never the entry, and never the user's request.
    const before: Promise<Before> = (async (): Promise<Before> => {
      try {
        // `req.tenantId` is NOT set yet, the auth middleware that populates it
        // lives INSIDE each router, which runs after this hook. Read the header
        // the client actually sent. (Same trap as req.params and req.baseUrl:
        // this hook runs before Express has populated any of them.)
        const tenantId = req.get("x-tenant-id") ?? req.tenantId;
        if (!tenantId) return {};

        // req.params is EMPTY here: Express only fills it once a router has
        // matched, and this hook runs before that. Read the id straight out of
        // the path. (Same trap as req.baseUrl: don't lean on state Express
        // hasn't populated yet.)
        const parts = (relativePath(req) ?? "").split("/").filter(Boolean);
        const first = parts[0];
        const meta = first ? DOMAINS[first] : undefined;
        const id = parts[1]; // "/courses/01ABC…" → the id

        const out: Before = {};

        if (meta?.table && id && (req.method === "PUT" || req.method === "PATCH")) {
          out.table = meta.table;
          out.id = id;
          out.row = await tenantAuditService.snapshot(meta.table, id, tenantId);
        }

        // Resolve names for EVERY write, not just DELETE.
        //
        // A DELETE needs it because the row is about to vanish. But a DENIED
        // request needs it just as much: requirePermission() throws before the
        // router matches, so req.params is empty and the after-the-fact resolver
        // finds nothing, leaving "tried to rename a role" instead of naming it.
        out.names = await resolveNamesEarly(req, tenantId);

        return out;
      } catch {
        return {};
      }
    })();

    res.on("finish", () => {
      // Fire-and-forget: the response is already sent, so a name lookup here
      // costs the user nothing.
      void (async () => {
      try {
        const entry = resolveAction(req);
        if (!entry) return;

        // A 4xx/5xx that isn't a permission denial is a failed attempt, not an
        // audit event, the user fumbled a form. We log denials (403) because
        // "Rahul tried to refund and was denied" is exactly what an owner wants
        // to see, and successes because that's the point.
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        const denied = res.statusCode === 403;
        if (!ok && !denied) return;

        const tenantId = req.tenantId;
        const user = req.tenantUser;
        if (!tenantId || !user) return;

        const payload = ok ? unwrap(captured) : null;

        // The custom-code page editor autosaves a few seconds after typing
        // stops. One sitting is one edit to the person reading the log, not
        // forty, keep the first save and fold the rest into it.
        if (
          ok &&
          COALESCED_ACTIONS.has(entry.action.action) &&
          (await tenantAuditService.recentlyRecorded({
            tenantId,
            actorUserId: user.id,
            action: entry.action.action,
            resourceId: resourceId(payload, req),
            withinMs: COALESCE_WINDOW_MS,
          }))
        ) {
          return;
        }

        // A DELETE returns no body, so there is nothing to read a name from.
        // which is why deletions read "deleted a credential" instead of naming
        // it. resolveNamesEarly() already looked it up before the row vanished;
        // fall back to that.
        const early = (await before).names ?? {};
        const label =
          resourceLabel(payload, req) ?? Object.values(early)[0] ?? null;

        // Turn the ids in the URL and body into names, so the entry can say
        // "set Afeefa Sheikh's roles to Educator" instead of "changed which
        // roles a teammate has", which is what every one of them said before.
        const ctx: AuditContext = {
          label,
          params: (req.params ?? {}) as Record<string, string>,
          body: (req.body ?? {}) as Record<string, unknown>,
          names:
            (await before).names ??
            (await tenantAuditService.resolveNames(tenantId, entry.action, req)),
        };

        const summary = tenantAuditService.buildSummary(
          entry.action,
          user.name ?? null,
          label,
          ok,
          ctx
        );

        void tenantAuditService.record({
          tenantId,
          actor: {
            id: user.id ?? null,
            email: user.email ?? null,
            name: user.name ?? null,
          },
          action: entry.action.action,
          category: entry.action.category,
          resourceType: entry.action.resourceType ?? null,
          resourceId: resourceId(payload, req),
          resourceLabel: label,
          summary,
          succeeded: ok,
          metadata: buildMetadata(
            req,
            entry.action,
            ok,
            ctx.names,
            (await before).row ?? null,
            // Re-read the SAME row after the write. The response payload is a
            // DTO (camelCase, computed fields), so diffing it against the raw
            // DB row we snapshotted marks every field as changed. Row vs row.
            (await before).row
              ? await tenantAuditService.snapshot(
                  (await before).table as string,
                  (await before).id as string,
                  tenantId
                )
              : null
          ),
          request: req,
        });
      } catch {
        // A broken audit line must never surface to the user, the request has
        // already been answered. The service logs its own failures.
      }
      })();
    });

    next();
  };
}

/** Actions saved repeatedly in one sitting, see the autosave note above. */
const COALESCED_ACTIONS = new Set(["pages.update"]);
const COALESCE_WINDOW_MS = 10 * 60 * 1000;

/** `dryRun`/`dry_run` in the body, or `?dryRun=true|1`, every form we accept. */
function isDryRun(req: Request): boolean {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.dryRun === true || body.dry_run === true) return true;
  const q = (req.query as Record<string, unknown> | undefined)?.dryRun;
  return q === "true" || q === "1";
}

/** What we managed to capture before the handler ran. */
interface Before {
  row?: Record<string, unknown> | null;
  names?: Record<string, string>;
  /** Kept so we can re-read the SAME row after the write and diff row-vs-row. */
  table?: string;
  id?: string;
}

/**
 * Name the thing a DELETE is about to destroy, while the row still exists.
 *
 * Cannot use resolveAction()/resolveNames(): both read `req.route` and
 * `req.params`, and Express populates NEITHER until a router has matched, which
 * happens after this hook. (Third time today I've been caught by this.) So we
 * work from the raw URL, which is always complete.
 *
 * "/tenant/team/roles/01ABC" → look up role 01ABC → { "01ABC": "Educator" }
 */
async function resolveNamesEarly(
  req: Request,
  tenantId: string
): Promise<Record<string, string> | undefined> {
  const parts = (relativePath(req) ?? "").split("/").filter(Boolean);

  // The id is the last segment that looks like one.
  const id = [...parts].reverse().find((p) => /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(p));
  if (!id) return undefined;

  // What KIND of thing is it? Read it off the path segment before the id.
  const kind = parts[parts.indexOf(id) - 1];

  try {
    if (kind === "roles") {
      const row = await db
        .selectFrom("tenant_roles")
        .select(["id", "name"])
        .where("id", "=", id)
        .where((eb) =>
          eb.or([eb("tenant_id", "=", tenantId), eb("tenant_id", "is", null)])
        )
        .executeTakeFirst();
      return row ? { [row.id]: row.name } : undefined;
    }

    if (kind === "members" || kind === "staff") {
      const row = await db
        .selectFrom("tenant_users")
        .select(["id", "name", "email"])
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? { [row.id]: row.name || row.email || "someone" } : undefined;
    }
    // Everything else: read the row from the table the domain map already knows
    // about, and take whatever it calls its name. Without this a DELETE reads
    // "deleted a credential", true, and useless when you're trying to work out
    // WHICH credential someone removed.
    const domainKey = parts[0];
    const meta = DOMAINS[domainKey];
    if (meta?.table) {
      const row = (await db
        .selectFrom(meta.table as never)
        .selectAll()
        .where("id" as never, "=", id as never)
        .where("tenant_id" as never, "=", tenantId as never)
        .executeTakeFirst()) as Record<string, unknown> | undefined;

      if (row) {
        for (const key of ["title", "name", "label", "email", "code"]) {
          const v = row[key];
          if (typeof v === "string" && v.trim()) return { [id]: v.trim() };
        }
      }
    }
  } catch {
    // Best effort, a missing name costs us a word, not the entry.
  }

  return undefined;
}

function resolveAction(
  req: Request
): { action: AuditAction } | undefined {
  // The registry is keyed on the tenant-relative ROUTE PATTERN, the
  // "/roles/:roleId/duplicate" shape, so the key is stable no matter which
  // role it was. Building that key means combining two things:
  //
  //   req.originalUrl  the concrete path, ALWAYS complete
  //                    ("/api/v1/tenant/team/roles/01ABC/duplicate?x=1")
  //   req.route.path   the leaf pattern the router matched ("/:roleId/duplicate")
  //
  // We deliberately do NOT use req.baseUrl. This middleware is mounted on a
  // PATH (`v1Router.use("/tenant", auditLog())`) rather than being a router, so
  // Express leaves req.baseUrl as "" here. Worse, it's "" only on the path that
  // matters most: when requirePermission() THROWS, the inner router never runs
  // its own mounting, so a denied request looked like `POST /roles` and missed
  // the registry entirely, every 403 went unlogged while successes worked by
  // coincidence. Deriving the prefix from originalUrl is immune to all of that.
  const routePath = (req.route as { path?: string } | undefined)?.path;
  if (!routePath) return undefined;

  const relative = relativePath(req); // "/team/roles/01ABC/duplicate"
  if (!relative) return undefined;

  // Replace the concrete leaf with its pattern:
  //   "/team/roles/01ABC/duplicate" + "/:roleId/duplicate" → "/team/roles/:roleId/duplicate"
  const leafSegments = routePath.split("/").filter(Boolean).length;
  const segments = relative.split("/").filter(Boolean);
  const prefix = segments.slice(0, segments.length - leafSegments).join("/");

  const key = `/${prefix}${routePath === "/" ? "" : routePath}`;

  const action = lookupAuditAction(req.method, key);
  return action ? { action } : undefined;
}

/**
 * The path the registry is keyed on, from either mount this hook sits on:
 *
 *   "/api/v1/tenant/team/roles/01ABC?x=1"  →  "/team/roles/01ABC"
 *   "/api/v1/pages/01ABC/publish"          →  "/pages/01ABC/publish"
 *
 * The pages router lives at /pages, not /tenant/pages. Mounting the hook there
 * was not enough on its own: every lookup here searched for "/tenant/", found
 * nothing, and quietly dropped the entry, so page edits stayed unlogged.
 */
function relativePath(req: Request): string | null {
  const path = req.originalUrl.split("?")[0];

  const tenant = path.indexOf("/tenant/");
  if (tenant !== -1) return path.slice(tenant + "/tenant".length);

  const pages = path.match(/\/v1(\/pages(?:\/.*)?)$/);
  if (pages) return pages[1];

  return null;
}

/** Our responses are `{ success, data, ... }`, the resource is under `data`. */
function unwrap(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

/** The thing's human name, whatever the resource happens to call it. */
function resourceLabel(
  payload: Record<string, unknown> | null,
  req: Request
): string | null {
  // `order_number` is how store orders are identified, without it "marked the
  // order as shipped" logs with no way to tell WHICH order.
  for (const key of ["name", "title", "label", "email", "code", "slug", "order_number"]) {
    const v = payload?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // Deleting something returns no body, fall back to whatever the caller sent.
  const body = req.body as Record<string, unknown> | undefined;
  for (const key of ["name", "title", "email"]) {
    const v = body?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function resourceId(
  payload: Record<string, unknown> | null,
  req: Request
): string | null {
  const fromBody = payload?.id;
  if (typeof fromBody === "string") return fromBody;

  // On DELETE/PUT the id is in the URL, not the (often empty) response.
  const params = req.params as Record<string, string>;
  return params.id ?? params.roleId ?? params.userId ?? null;
}

/**
 * What changed. The request body is the closest thing we have to a diff without
 * reading the row twice, good enough to answer "what did they set it to?".
 * Redaction happens in the service, but we skip the body entirely for the
 * actions that carry credentials.
 */
function buildMetadata(
  req: Request,
  action: AuditAction,
  succeeded: boolean,
  names: Record<string, string>,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Record<string, unknown> | null {
  const meta: Record<string, unknown> = {};

  if (!succeeded) {
    // The whole point of logging a denial: which permission was missing.
    meta.denied = true;
    meta.path = req.originalUrl;
    return meta;
  }

  if (action.redactBody) return null;

  // THE DIFF. An edit PUTs the whole object, so the body is not a list of
  // changes, it is the entire record. Changing one price sent sixteen fields,
  // and the log dutifully reported all sixteen as "what changed". Compare the
  // row we snapshotted BEFORE the write against what it is now, and report only
  // the fields that actually moved.
  if (before && after) {
    const diff = diffRows(before, after, names);
    if (Object.keys(diff).length > 0) meta.changes = diff;
    return Object.keys(meta).length > 0 ? meta : null;
  }

  // No snapshot (a create, or a table we don't map), the body IS the change.
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object" && Object.keys(body).length > 0) {
    const changes = humanise(body, names);
    if (Object.keys(changes).length > 0) meta.changes = changes;
  }

  return Object.keys(meta).length > 0 ? meta : null;
}

/** Compare two rows and describe only what moved, as "old → new". */
function diffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  names: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    if (NOISE_FIELDS.has(key)) continue;

    const a = before[key];
    const b = after[key];
    if (same(a, b)) continue;

    const from = short(a, names);
    const to = short(b, names);
    if (from === null && to === null) continue;

    out[humaniseKey(key)] =
      from === null ? to : `${from} → ${to}`;
  }

  return out;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** A value, short enough to sit in a log line, or null if it never should. */
function short(v: unknown, names: Record<string, string>): string | null {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toLocaleDateString();

  if (typeof v === "string") {
    if (names[v]) return names[v];
    if (v.length > MAX_VALUE_LEN) return null; // prose, never useful here
    return v;
  }

  // Objects and arrays (prices JSON, learning outcomes…) are not a log line.
  return null;
}

/** "roleIds" → "Roles"; "capabilityIds" → "Capabilities"; "isPublished" → "Is published". */
function humaniseKey(key: string): string {
  // Drop the Id/Ids suffix FIRST, then pluralise the bare noun properly.
  // naively appending "s" gives "Capabilitys".
  const plural = /Ids$/.test(key);
  let word = key
    .replace(/Ids?$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();

  if (plural) word = word.endsWith("y") ? word.slice(0, -1) + "ies" : word + "s";

  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Fields a person would never want in an audit entry.
 *
 * An edit sends the WHOLE object, slug, prices JSON, a 200-word description,
 * thumbnails, every field the form touched. Dumping that is not "details", it's
 * a database row, and it buries the one or two facts that matter.
 *
 * So this is a DENYLIST of noise, plus a hard limit on length below. The entry's
 * summary already says what happened; Details exists only to answer "…and what
 * did they set it to?" for things a human would actually ask about.
 */
const NOISE_FIELDS = new Set([
  "id",
  // The summary already says "published the course X", repeating
  // `Publish: true` underneath it is noise, not detail.
  "publish",
  "isPublished",
  "slug",
  "description",
  "content",
  "html",
  "body",
  "thumbnail",
  "thumbnailUrl",
  "coverImage",
  "image",
  "imageUrl",
  "metadata",
  "seo",
  "sections",
  "curriculum",
  "faqs",
  "theme",
  "config",
  "settings",
  "createdAt",
  "updatedAt",
  // Snake-case too, the diff compares raw DB rows, not the camelCase DTO.
  "created_at",
  "updated_at",
  "tenant_id",
  "updated_by",
  "created_by",
]);

/** Long prose is never a useful audit detail, a title is, a synopsis isn't. */
const MAX_VALUE_LEN = 80;

/**
 * Turn the raw request body into something an owner can read.
 *
 * The body is the closest thing we have to a diff, but it is written for the
 * API, not for a person: `{"roleIds": ["01KXE08A4KTQQ19VKFJ5AGMQ9Y"]}` answers
 * nothing. Anywhere we already resolved an id to a name, show the name; label
 * the fields in English; and drop the noise entirely.
 *
 *   { "roleIds": ["01KXE…"] }  →  { "Roles": "Educator" }
 */
function humanise(
  body: Record<string, unknown>,
  names: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const nameOf = (v: unknown) =>
    typeof v === "string" && names[v] ? names[v] : v;

  /**
   * An id we could not resolve must NEVER print itself. A permission code or a
   * ULID in a log meant for people is worse than saying nothing: it looks like
   * a leak, and it is exactly the internal vocabulary this project set out to
   * hide. Drop it and let the summary carry the meaning.
   */
  const isInternal = (v: unknown) =>
    typeof v === "string" &&
    (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(v) || // ULID
      /^[a-z0-9_]+\.[a-z0-9_.]+$/i.test(v)); // dotted code: courses.publish

  for (const [key, value] of Object.entries(body)) {
    if (NOISE_FIELDS.has(key)) continue;

    // Objects and long prose belong in the app, not in a log line.
    if (value && typeof value === "object" && !Array.isArray(value)) continue;
    if (typeof value === "string" && value.length > MAX_VALUE_LEN) continue;

    const label = humaniseKey(key);

    if (Array.isArray(value)) {
      const mapped = value.map(nameOf).filter((v) => !isInternal(v));
      if (mapped.length === 0) continue; // nothing readable, say nothing
      // A list of ids we resolved reads best as a sentence: "Educator and Ops".
      const allNamed = mapped.every((v) => typeof v === "string");
      out[label] =
        allNamed && mapped.length > 1
          ? mapped.slice(0, -1).join(", ") + " and " + mapped[mapped.length - 1]
          : mapped.length === 1
            ? mapped[0]
            : mapped;
    } else {
      out[label] = nameOf(value);
    }
  }

  return out;
}

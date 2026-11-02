import { NextFunction, Request, Response } from "express";

import auditService from "../services/audit.service";
import geoDeviceService from "../services/geo-device.service";
import { buildAuditActor } from "../utils/audit-actor.util";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths excluded from auto-audit: auth (logged explicitly with richer detail).
const SKIP = [/\/admin\/auth\//];

const CATEGORY_MAP: Record<string, string> = {
  tenants: "TENANT",
  "tenant-analytics": "TENANT",
  "tenant-users": "TENANT",
  "staff-members": "TENANT",
  members: "TENANT",
  subscriptions: "SUBSCRIPTION",
  plans: "PLAN",
  products: "PRODUCT",
  features: "FEATURE",
  applications: "APPLICATION",
  entitlements: "ENTITLEMENT",
  addons: "ADDON",
  users: "ADMIN_USER",
  roles: "ADMIN_ROLE",
  permissions: "ADMIN_PERMISSION",
  "billing-providers": "BILLING_PROVIDER",
};

const categoryFromPath = (path: string): string => {
  const m = path.match(/\/admin\/([^/?]+)/);
  if (!m) return "OTHER";
  return CATEGORY_MAP[m[1]] ?? m[1].toUpperCase().replace(/-/g, "_");
};

const ACTION_BY_METHOD: Record<string, string> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

/**
 * Phase 5: auto-log every state-changing admin action (POST/PUT/PATCH/DELETE)
 * with actor, IP, parsed device, and geolocation. Records after the response
 * finishes and only for successful (2xx/3xx) authenticated admin requests, so
 * it never blocks or breaks the request. Reads (GET) are intentionally skipped.
 */
export const autoAuditAdminMutations = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const method = req.method.toUpperCase();
  const path = (req.originalUrl || req.url).split("?")[0];
  const isAdmin = path.includes("/admin/");
  if (!MUTATING.has(method) || !isAdmin || SKIP.some((r) => r.test(path))) {
    return next();
  }

  res.on("finish", () => {
    try {
      if (res.statusCode < 200 || res.statusCode >= 400) return;
      const actor = buildAuditActor(req);
      if (!actor.adminId) return; // only attributed admin actions

      const ua = geoDeviceService.parseUserAgent(actor.userAgent);
      const rawId =
        req.params?.id ?? req.params?.taskId ?? req.params?.tenantId;
      const resourceId = typeof rawId === "string" ? rawId : null;

      // Geo lookup is async + best-effort; the whole thing is fire-and-forget.
      void geoDeviceService
        .getFullGeoFromIp(actor.ipAddress)
        .then((geo) =>
          auditService.record({
            actor,
            action: ACTION_BY_METHOD[method] ?? method,
            category: categoryFromPath(path),
            resourceId,
            summary: `${actor.name ?? actor.email ?? "admin"} ${method} ${path}`,
            metadata: { method, path, status: res.statusCode },
            device: ua.device,
            browser: ua.browser,
            os: ua.os,
            country: geo.country,
            region: geo.region,
            city: geo.city,
          })
        )
        .catch(() => {
          /* never break on audit failure */
        });
    } catch {
      /* never break the response */
    }
  });

  next();
};

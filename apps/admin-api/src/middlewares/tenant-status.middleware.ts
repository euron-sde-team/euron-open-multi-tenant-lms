import { Request, Response, NextFunction } from "express";
import { db } from "../db/connection";
import { ForbiddenError } from "../errors/forbidden.error";

/**
 * Tenant status enforcement middleware.
 *
 * It is mounted in v1.route.ts in front of each router, which is BEFORE the
 * router's own authenticateTenantUser has resolved req.tenantId. So when there
 * is no tenant yet it only marks the request, and authenticateTenantUser calls
 * enforceTenantStatus() once it knows the tenant.
 *
 * - ACTIVE: full access
 * - SUSPENDED: read-only + subscription routes allowed
 * - CANCELLED: only subscription/plan/reactivation routes allowed
 * - PENDING: blocked
 */
export const requireActiveTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    req.requireActiveTenant = true;
    return next();
  }
  await enforceTenantStatus(req);
  next();
};

/** Throws unless the tenant's status allows this request (see the header). */
export async function enforceTenantStatus(req: Request): Promise<void> {
  const tenantId = req.tenantId;
  if (!tenantId) return;

  const tenant = await db
    .selectFrom("tenants")
    .select(["id", "status"])
    .where("id", "=", tenantId)
    .executeTakeFirst();

  if (!tenant) {
    throw new ForbiddenError("Tenant not found");
  }

  req.tenantStatus = tenant.status;

  if (tenant.status === "ACTIVE") {
    return;
  }

  const isRead = req.method === "GET" || req.method === "HEAD";
  // originalUrl, not path: path is relative to the router mount point.
  const url = req.originalUrl.split("?")[0];
  const isSubscriptionRoute =
    url.includes("/subscriptions") || url.includes("/plans") || url.includes("/payment");

  if (tenant.status === "SUSPENDED") {
    // Allow reads and subscription management routes
    if (isRead || isSubscriptionRoute) {
      return;
    }
    throw new ForbiddenError(
      "Account suspended. Update your subscription to resume full access."
    );
  }

  if (tenant.status === "CANCELLED") {
    // Only allow subscription/reactivation routes
    if (isSubscriptionRoute) {
      return;
    }
    throw new ForbiddenError(
      "Subscription cancelled. Subscribe to a plan to regain access."
    );
  }

  // PENDING or unknown status
  throw new ForbiddenError("Account not active");
}

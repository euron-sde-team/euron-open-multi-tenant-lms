import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import {
  ADMIN_AUTOGRANT_EXCLUDED,
  TENANT_ADMIN_ROLE_CODE,
} from "../services/team.service";

/**
 * Both factories below answer a tenant-scoped question: "may this user do X
 * INSIDE tenant T?" That question is meaningless without a T.
 *
 * authenticateTenantUser only loads roles/permissions once it resolves a tenant,
 * so a caller with no active membership (a brand-new account that has not
 * created its organization yet) reaches here with isOwner=false and an empty
 * permission set. Every check then fails with "Insufficient permissions", which
 * sends whoever debugs it hunting through roles and capabilities for a
 * permission problem that does not exist.
 *
 * Say what is actually wrong instead. Still a 403, since a tenant-scoped write
 * with no tenant must not proceed, and the message matches the phrase the admin
 * portal's axios interceptor already keys off to reset a stale tenant selection.
 *
 * If this fires for a route a tenant-less user is SUPPOSED to reach, the route
 * is mis-gated: that action is account-scoped rather than tenant-scoped, and
 * belongs behind authentication alone (see POST /tenant/organization).
 */
function ensureTenantContext(req: Request): void {
  if (!req.tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
}

/**
 * The rule requirePermission() enforces, as a plain answer, for UI that needs
 * to know in advance ("can this person pay?") without trying and failing.
 * One rule, so the two can never disagree.
 */
export function hasPermissions(
  user: Request["tenantUser"],
  permissions: string[]
): boolean {
  // Owner always has full access
  if (user.isOwner) return true;

  // Admin has full access except permissions excluded from the admin auto-grant
  // (owner-only codes + admin-restricted-but-delegatable codes like videos.download).
  const isAdmin = user.roles.includes(TENANT_ADMIN_ROLE_CODE);
  if (isAdmin && permissions.every((p) => !ADMIN_AUTOGRANT_EXCLUDED.has(p))) {
    return true;
  }

  // Check if user has ALL required permissions
  const userPerms = new Set(user.permissions);
  return permissions.every((p) => userPerms.has(p));
}

/**
 * Require ALL specified permissions.
 * Owner and Admin bypass permission checks (Admin is barred only from
 * OWNER_ONLY_PERMISSIONS). This bypass is catalog-independent: admins get
 * access regardless of which permission codes are seeded.
 */
export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = req.tenantUser;

    ensureTenantContext(req);

    if (!hasPermissions(user, permissions)) {
      throw new ForbiddenError("Insufficient permissions");
    }

    next();
  };
};

/**
 * Require ANY of the specified permissions.
 * Owner and Admin bypass permission checks. Admin passes unless every required
 * permission is owner-only.
 */
export const requireAnyPermission = (...permissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const user = req.tenantUser;

    ensureTenantContext(req);

    // Owner always has full access
    if (user.isOwner) return next();

    // Admin has full access unless EVERY required permission is excluded from the
    // admin auto-grant (owner-only + admin-restricted codes like videos.download).
    const isAdmin = user.roles.includes(TENANT_ADMIN_ROLE_CODE);
    if (isAdmin && !permissions.every((p) => ADMIN_AUTOGRANT_EXCLUDED.has(p))) {
      return next();
    }

    // Check if user has ANY of the required permissions
    const userPerms = new Set(user.permissions);
    const hasAny = permissions.some((p) => userPerms.has(p));

    if (!hasAny) {
      throw new ForbiddenError("Insufficient permissions");
    }

    next();
  };
};

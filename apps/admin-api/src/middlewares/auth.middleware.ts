import { NextFunction, Request, Response } from "express";
import { staff_membership_status, tenant_user_status } from "../db/enums";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { enforceTenantStatus } from "./tenant-status.middleware";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantUserRepository from "../repositories/tenant-user.repository";
import tenantAuthService from "../services/tenant-auth.service";
import teamService from "../services/team.service";
import { TokenType } from "../types/auth.type";
import logger from "../utils/logger";

/**
 * Message thrown when an X-Tenant-Id header points at a tenant the caller may
 * not act on. Kept stable because the admin portal's axios interceptor matches
 * on this text to recover (clear selection, refetch /me, pick a valid org).
 */
const TENANT_ACCESS_DENIED_MESSAGE = "You do not have access to this tenant";

/**
 * Builds the tenant-user authentication middleware.
 *
 * `allowStaleTenant` controls what happens when the X-Tenant-Id header names a
 * tenant the caller cannot act on:
 * - strict (false, the app-wide default): throw ForbiddenError so a stale or
 *   foreign header can never silently return another org's data.
 * - lenient (true, profile/self routes only e.g. /me, /logout): flag it and
 *   fall back to the first active membership so the client can always recover.
 *
 * Access is membership based: a caller acts on a tenant only through an
 * ACTIVE staff membership, with the roles granted on it.
 */
const createTenantAuth =
  ({ allowStaleTenant }: { allowStaleTenant: boolean }) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError("No token provided");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new UnauthorizedError("Invalid authorization header format");
    }

    const token = parts[1];

    try {
      // Verify token and check type
      const decoded = tenantAuthService.verifyToken(token);

      if (decoded.type !== TokenType.TENANT) {
        throw new UnauthorizedError("Invalid token type");
      }

      // Fetch user from database
      const user = await tenantUserRepository.findById(decoded.id);

      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      if (user.status !== tenant_user_status.ACTIVE) {
        throw new UnauthorizedError("Account is not active");
      }

      // Attach user to request (roles/permissions populated below)
      req.tenantUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        status: user.status,
        email_verified: user.email_verified,
        roles: [],
        permissions: [],
        isOwner: false,
      };

      // Also set legacy user object for backward compatibility
      req.user = { id: user.id };

      // Get tenant context from header or default to first active membership
      const tenantIdHeader = req.headers["x-tenant-id"] as string | undefined;

      if (tenantIdHeader) {
        // Verify user has an active membership for this tenant
        const membership =
          await tenantMembershipRepository.findByUserIdAndTenantId(
            user.id,
            tenantIdHeader
          );
        const isActiveMember =
          membership?.status === staff_membership_status.ACTIVE;

        if (isActiveMember) {
          req.tenantId = tenantIdHeader;
        } else {
          // Stale or foreign tenant selection.
          req.tenantAccessDenied = true;
          if (!allowStaleTenant) {
            logger.warn(
              `User ${user.id} denied stale/foreign X-Tenant-Id: ${tenantIdHeader}`
            );
            throw new ForbiddenError(TENANT_ACCESS_DENIED_MESSAGE);
          }
          logger.warn(
            `User ${user.id} sent stale X-Tenant-Id: ${tenantIdHeader}, falling back to default`
          );
        }
      }

      // If no valid tenant resolved yet, pick the first active membership
      if (!req.tenantId) {
        const memberships =
          await tenantMembershipRepository.findByUserIdWithTenants(user.id);
        const activeMembership = memberships.find(
          (m) => m.status === staff_membership_status.ACTIVE
        );

        if (activeMembership) {
          req.tenantId = activeMembership.tenant_id;
        }
        // If no active membership exists, req.tenantId stays undefined
        //, user can still access /me (returns empty tenants list)
      }

      // A route mounted behind requireActiveTenant: check now that the
      // tenant is known.
      if (req.requireActiveTenant && req.tenantId) {
        await enforceTenantStatus(req);
      }

      // Load roles and permissions for the resolved tenant
      if (req.tenantId) {
        const { roles, permissions, isOwner } =
          await teamService.loadUserPermissions(user.id, req.tenantId);
        req.tenantUser.roles = roles;
        req.tenantUser.permissions = permissions;
        req.tenantUser.isOwner = isOwner;
      }

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        throw error;
      }
      logger.error("Authentication error:", error);
      throw new UnauthorizedError("Invalid or expired token");
    }
  };

/**
 * Authenticate tenant user (strict). Throws if the X-Tenant-Id header names a
 * tenant the caller cannot act on. This is the app-wide default.
 */
export const authenticateTenantUser = createTenantAuth({
  allowStaleTenant: false,
});

/**
 * Authenticate tenant user (lenient). A stale/foreign X-Tenant-Id falls back to
 * the first active membership instead of throwing. Use ONLY on profile/self
 * routes (/me, /logout, /me/*) so the client can always recover its tenant
 * context after a stale selection.
 */
export const authenticateTenantUserLenient = createTenantAuth({
  allowStaleTenant: true,
});

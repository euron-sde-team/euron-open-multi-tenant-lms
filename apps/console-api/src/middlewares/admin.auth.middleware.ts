import { NextFunction, Request, Response } from "express";
import { admin_user_status } from "../db/enums";
import { ForbiddenError } from "../errors/forbidden.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import adminUserRepository from "../repositories/admin-user.repository";
import adminAuthService from "../services/admin.auth.service";
import logger from "../utils/logger";

/**
 * Middleware to authenticate admin users via JWT
 * Attaches adminUser object to request with roles and permissions
 */
export const authenticateAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("No token provided");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedError("Token format invalid. Use: Bearer <token>");
  }

  const token = parts[1];

  try {
    const decoded = adminAuthService.verifyToken(token);

    // Re-read the operator on every request so a suspension or
    // deactivation takes effect immediately, not when the JWT expires.
    const user = await adminUserRepository.findById(decoded.id);

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (user.status !== admin_user_status.ACTIVE) {
      throw new UnauthorizedError("Account is not active");
    }

    // Fetch user roles and permissions
    const [roles, permissions] = await Promise.all([
      adminUserRepository.getUserRoles(decoded.id),
      adminUserRepository.getUserPermissions(decoded.id),
    ]);

    // Attach admin user to request
    req.adminUser = {
      id: decoded.id,
      email: decoded.email,
      name: user.name,
      roles,
      permissions,
    };

    next();
  } catch (error) {
    logger.error("Admin auth error:", error);
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Invalid or expired token");
  }
};

/**
 * Middleware factory to require a specific role
 * Must be used after authenticateAdmin
 */
export const requireRole = (roleCode: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      throw new UnauthorizedError("Authentication required");
    }

    // SUPERADMIN has access to everything
    if (req.adminUser.roles.includes("SUPERADMIN")) {
      next();
      return;
    }

    if (!req.adminUser.roles.includes(roleCode)) {
      throw new ForbiddenError(`Role '${roleCode}' is required`);
    }

    next();
  };
};

/**
 * Middleware factory to require a specific permission
 * Must be used after authenticateAdmin
 */
export const requirePermission = (permissionCode: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      throw new UnauthorizedError("Authentication required");
    }

    // SUPERADMIN has access to everything
    if (req.adminUser.roles.includes("SUPERADMIN")) {
      next();
      return;
    }

    if (!req.adminUser.permissions.includes(permissionCode)) {
      throw new ForbiddenError(`Permission '${permissionCode}' is required`);
    }

    next();
  };
};

/**
 * Middleware factory to require any of the specified roles
 * Must be used after authenticateAdmin
 */
export const requireAnyRole = (roleCodes: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      throw new UnauthorizedError("Authentication required");
    }

    // SUPERADMIN has access to everything
    if (req.adminUser.roles.includes("SUPERADMIN")) {
      next();
      return;
    }

    const hasAnyRole = roleCodes.some((code) => req.adminUser!.roles.includes(code));

    if (!hasAnyRole) {
      throw new ForbiddenError(`One of these roles is required: ${roleCodes.join(", ")}`);
    }

    next();
  };
};

/**
 * Middleware factory to require any of the specified permissions
 * Must be used after authenticateAdmin
 */
export const requireAnyPermission = (permissionCodes: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.adminUser) {
      throw new UnauthorizedError("Authentication required");
    }

    // SUPERADMIN has access to everything
    if (req.adminUser.roles.includes("SUPERADMIN")) {
      next();
      return;
    }

    const hasAnyPermission = permissionCodes.some((code) =>
      req.adminUser!.permissions.includes(code)
    );

    if (!hasAnyPermission) {
      throw new ForbiddenError(`One of these permissions is required: ${permissionCodes.join(", ")}`);
    }

    next();
  };
};

import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/unauthorized.error";
import adminAuthService from "../services/admin.auth.service";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * POST /api/v1/admin/auth/login
 * Admin user login with email and password
 */
export const login = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { email, password } = req.body;

  const { ipAddress, userAgent } = buildAuditActor(req);
  const data = await adminAuthService.login(email, password, {
    ipAddress,
    userAgent,
  });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Login successful",
  });
};

/**
 * GET /api/v1/admin/auth/me
 * Get current admin user profile with roles and permissions
 */
export const me = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  const data = await adminAuthService.getMe(req.adminUser.id);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
  });
};

/**
 * POST /api/v1/admin/auth/logout
 * Logout admin user (client-side token invalidation)
 */
export const logout = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  // JWT tokens are stateless, so logout is handled client-side
  // The client should discard the token
  // For enhanced security, implement token blacklisting with Redis

  sendSuccessResponse({
    res,
    data: { message: "Logged out successfully" },
    statusCode: HttpSuccessStatus.OK,
    message: "Logout successful",
  });
};

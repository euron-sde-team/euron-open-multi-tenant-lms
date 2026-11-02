import { Request, Response } from "express";
import config from "../config";
import tenantAuthService from "../services/tenant-auth.service";
import { BadRequestError } from "../errors/bad-request.error";
import { IResponseFormat } from "../types/response.type";
import { RequestMeta } from "../types/auth.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Extract metadata from the HTTP request (IP, user-agent, referrer, UTM, timezone)
 */
function extractRequestMeta(req: Request): RequestMeta {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ||
    (req.headers["x-real-ip"] as string) ||
    req.ip ||
    "";

  return {
    ip,
    userAgent: req.headers["user-agent"] || "",
    referrer: req.headers["referer"] || "",
    utm: req.body.utm || null,
    timezone: req.body.timezone || "",
  };
}

/**
 * Signup - Register new user account
 */
export const signup = async (req: Request, res: Response<IResponseFormat>) => {
  const { email, password, name, phone } = req.body;
  const meta = extractRequestMeta(req);

  const result = await tenantAuthService.signup(
    { email, password, name, phone },
    meta
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Account created successfully",
  });
};

/**
 * Login - Authenticate tenant user
 */
export const login = async (req: Request, res: Response<IResponseFormat>) => {
  const { email, password } = req.body;
  const meta = extractRequestMeta(req);

  const result = await tenantAuthService.login(email, password, meta);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Login successful",
  });
};

/**
 * Me - Get current authenticated user profile
 */
export const me = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;

  const result = await tenantAuthService.getMe(userId);

  sendSuccessResponse({
    res,
    data: {
      ...result,
      roles: req.tenantUser.roles,
      permissions: req.tenantUser.permissions,
      is_owner: req.tenantUser.isOwner,
      // Signals the frontend that the X-Tenant-Id header was stale
      tenant_access_denied: req.tenantAccessDenied ?? false,
      resolved_tenant_id: req.tenantId ?? null,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "User profile retrieved successfully",
  });
};

/**
 * Logout - Token invalidation is client-side
 */
export const logout = async (_req: Request, res: Response<IResponseFormat>) => {
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Logged out successfully",
  });
};

/**
 * Update user profile (name, designation)
 */
export const updateProfile = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;
  const { name, designation, phone } = req.body;

  const result = await tenantAuthService.updateProfile(userId, { name, designation, phone });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Profile updated successfully",
  });
};

/**
 * Upload user avatar
 */
export const uploadAvatar = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;

  if (!req.file) {
    throw new BadRequestError("No file provided");
  }

  const result = await tenantAuthService.uploadAvatar(userId, req.file);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Avatar uploaded successfully",
  });
};

/**
 * Remove user avatar
 */
export const removeAvatar = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;

  const result = await tenantAuthService.removeAvatar(userId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Avatar removed successfully",
  });
};

/**
 * Send a verification code to the signed-in user's email address.
 */
export const sendVerifyEmailOtp = async (req: Request, res: Response<IResponseFormat>) => {
  await tenantAuthService.sendVerifyEmailOtp(req.tenantUser.id);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Verification code sent",
  });
};

/**
 * Verify the emailed code and mark the email as verified.
 */
export const verifyEmail = async (req: Request, res: Response<IResponseFormat>) => {
  const { code } = req.body;
  const result = await tenantAuthService.verifyEmailOtp(req.tenantUser.id, code);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Email verified",
  });
};

/**
 * Forgot password - Send reset link email
 */
export const forgotPassword = async (req: Request, res: Response<IResponseFormat>) => {
  const { email } = req.body;
  // Use the configured admin portal URL, req.headers.origin is unreliable
  // because the admin portal proxies API requests through Next.js rewrites
  // (same-origin /api/proxy), so the Origin header is often missing.
  const frontendBaseUrl = config.ADMIN_PORTAL_URL || req.headers.origin || "http://localhost:3610";

  await tenantAuthService.forgotPassword(email, frontendBaseUrl);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "If an account with that email exists, a reset link has been sent",
  });
};

/**
 * Reset password - Set new password using token
 */
export const resetPassword = async (req: Request, res: Response<IResponseFormat>) => {
  const { token, password } = req.body;

  await tenantAuthService.resetPassword(token, password);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Password has been reset successfully",
  });
};

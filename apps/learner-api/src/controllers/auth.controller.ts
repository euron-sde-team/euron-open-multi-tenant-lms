import { NextFunction, Request, Response } from "express";
import authService from "../services/auth.service";
import sessionService from "../services/session.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  return tenantId;
}

function getTenantName(req: Request): string {
  return req.tenant?.name ?? "Platform";
}

function getDeviceInfo(req: Request): string | undefined {
  return req.headers["user-agent"] as string | undefined;
}

function getClientIp(req: Request): string | null {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.length) return cf.trim();
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

export const getAuthConfig = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const result = await authService.getAuthConfig(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Auth config retrieved",
  });
};

export const signup = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const result = await authService.signup(tenantId, req.body, getDeviceInfo(req));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Account created successfully",
  });
};

export const login = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const result = await authService.login(tenantId, req.body, getDeviceInfo(req), getClientIp(req));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Login successful",
  });
};

export const googleAuth = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const result = await authService.googleAuth(tenantId, req.body, getDeviceInfo(req));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Google authentication successful",
  });
};

export const sendOtp = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const tenantName = getTenantName(req);
  await authService.sendOtp(tenantId, tenantName, req.body);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "OTP sent successfully",
  });
};

export const verifyOtp = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const result = await authService.verifyOtp(tenantId, req.body, getDeviceInfo(req));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "OTP verified successfully",
  });
};

export const easyCheckoutSignup = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const tenantName = getTenantName(req);
  try {
    const result = await authService.easyCheckoutSignup(tenantId, tenantName, req.body, getDeviceInfo(req));
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.CREATED,
      message: "Account created successfully",
    });
  } catch (err) {
    // Structured conflict: surface matchedIdentifier + channel to the frontend so it can
    // switch into inline OTP recovery without an extra roundtrip. The OTP has already
    // been sent server-side.
    if (err instanceof ConflictError && err.message.startsWith("{")) {
      try {
        const payload = JSON.parse(err.message) as {
          kind: string;
          matchedIdentifier: string;
          channel: "email" | "whatsapp";
        };
        res.status(409).json({
          success: false,
          error: { message: "Account already exists. OTP sent." },
          kind: payload.kind,
          matchedIdentifier: payload.matchedIdentifier,
          channel: payload.channel,
          message: "Account already exists. OTP sent.",
          statusCode: 409,
        });
        return;
      } catch {
        // fall through to default error handler
      }
    }
    throw err;
  }
};

export const forgotPassword = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenantId = getTenantId(req);
  const tenantName = getTenantName(req);
  const { email } = req.body as { email: string };
  if (!email) throw new BadRequestError("Email is required");

  // Always build the reset link from the tenant's real primary domain, never
  // the request Origin (mobile clients send none → it fell back to localhost).
  const baseUrl = await getTenantBaseUrl(tenantId);
  await authService.forgotPassword(tenantId, email, tenantName, baseUrl);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "If an account with that email exists, a reset link has been sent",
  });
};

export const resetPassword = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  if (!token) throw new BadRequestError("Reset token is required");
  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  await authService.resetPassword(token, newPassword);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Password reset successfully",
  });
};

export const logout = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const sessionToken = (req.user as { sessionToken?: string })?.sessionToken;
  if (sessionToken) {
    await sessionService.invalidateSession(sessionToken);
  }
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Logged out successfully",
  });
};

export const getMe = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const result = await authService.getMe(memberId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Member profile retrieved",
  });
};

export const updateProfile = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const body = req.body as {
    name?: string;
    phone?: string;
    avatarUrl?: string;
    about?: string;
    gender?: string;
    profileMetadata?: Record<string, unknown>;
  };
  const result = await authService.updateProfile(memberId, body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Profile updated successfully",
  });
};

export const changePassword = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) throw new BadRequestError("Current password and new password are required");
  if (newPassword.length < 8) throw new BadRequestError("New password must be at least 8 characters");
  await authService.changePassword(memberId, currentPassword, newPassword);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Password changed successfully" });
};

export const uploadAvatar = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const file = req.file;
  if (!file) throw new BadRequestError("No file uploaded");
  const result = await authService.uploadAvatar(tenantId, memberId, file);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Avatar updated successfully",
  });
};

export const sendVerifyEmailOtp = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const tenantId = getTenantId(req);
  const tenantName = getTenantName(req);
  await authService.sendVerifyEmailOtp(tenantId, tenantName, memberId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Verification OTP sent successfully",
  });
};

export const verifyEmail = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const tenantId = getTenantId(req);
  const { code } = req.body as { code: string };
  if (!code) throw new BadRequestError("Verification code is required");
  const result = await authService.verifyEmailAndUpdate(tenantId, memberId, code);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Email verified successfully",
  });
};

export const sendConfirmNameEmailOtp = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const tenantId = getTenantId(req);
  const tenantName = getTenantName(req);
  const { email } = req.body as { email?: string };
  if (!email) throw new BadRequestError("Email is required");
  await authService.sendConfirmNameEmailOtp(tenantId, tenantName, memberId, email);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Verification code sent",
  });
};

export const confirmName = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  const tenantId = getTenantId(req);
  const { name, email, code } = req.body as { name?: string; email?: string; code?: string };
  if (!name) throw new BadRequestError("Name is required");
  const result = await authService.confirmName(tenantId, memberId, { name, email, code });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Name confirmed successfully",
  });
};

export const deleteMe = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  await authService.deleteProfile(memberId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Account deleted successfully",
  });
};

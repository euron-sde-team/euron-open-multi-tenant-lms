import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import {
  forgotPassword,
  login,
  logout,
  me,
  removeAvatar,
  resetPassword,
  sendVerifyEmailOtp,
  signup,
  updateProfile,
  uploadAvatar,
  verifyEmail,
} from "../controllers/tenant-auth.controller";
// Self/profile routes use the lenient variant: a stale X-Tenant-Id must never
// 403 here, so the client can always recover its tenant context via /me.
import { authenticateTenantUserLenient } from "../middlewares/auth.middleware";
import { authRateLimit } from "../middlewares/rate-limit.middleware";
import { asyncHandler } from "../utils/asynchandler";

const upload = multer({ storage: multer.memoryStorage() });

// Per-IP rate limit on OTP dispatch. Per-address rate limiting happens
// inside the service (1/min). This guards against IP-level abuse.
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { message: "Too many OTP requests." }, statusCode: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

const tenantAuthRouter: Router = Router();

// Public routes (no authentication required)
// Each is rate limited per IP and per email (see rate-limit.middleware.ts).
tenantAuthRouter.post("/signup", authRateLimit("signup"), asyncHandler(signup));
tenantAuthRouter.post("/login", authRateLimit("login"), asyncHandler(login));
tenantAuthRouter.post("/forgot-password", authRateLimit("password reset"), asyncHandler(forgotPassword));
tenantAuthRouter.post("/reset-password", authRateLimit("password reset"), asyncHandler(resetPassword));

// Protected routes (authentication required)
tenantAuthRouter.get("/me", asyncHandler(authenticateTenantUserLenient), asyncHandler(me));
tenantAuthRouter.post("/logout", asyncHandler(authenticateTenantUserLenient), asyncHandler(logout));

// Email verification (authenticated). Codes are rate limited per IP here and
// per address inside the service (one per minute).
tenantAuthRouter.post("/me/send-verify-email-otp", otpLimiter, asyncHandler(authenticateTenantUserLenient), asyncHandler(sendVerifyEmailOtp));
tenantAuthRouter.post("/me/verify-email", authRateLimit("verification"), asyncHandler(authenticateTenantUserLenient), asyncHandler(verifyEmail));

// Profile update (authenticated)
tenantAuthRouter.patch("/me/profile", asyncHandler(authenticateTenantUserLenient), asyncHandler(updateProfile));

// Avatar upload/remove (authenticated)
tenantAuthRouter.post("/me/avatar", asyncHandler(authenticateTenantUserLenient), upload.single("file"), asyncHandler(uploadAvatar));
tenantAuthRouter.delete("/me/avatar", asyncHandler(authenticateTenantUserLenient), asyncHandler(removeAvatar));

export default tenantAuthRouter;

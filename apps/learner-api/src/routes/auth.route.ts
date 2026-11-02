import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  getAuthConfig,
  signup,
  login,
  googleAuth,
  sendOtp,
  verifyOtp,
  easyCheckoutSignup,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  updateProfile,
  changePassword,
  deleteMe,
  uploadAvatar,
  sendVerifyEmailOtp,
  verifyEmail,
  sendConfirmNameEmailOtp,
  confirmName,
} from "../controllers/auth.controller";
import { authenticateUser } from "../middlewares/auth.middleware";
import config from "../config";
import { asyncHandler } from "../utils/asynchandler";
import { RateLimiter } from "../utils/rate-limit";
import { normalizePhone } from "../utils/normalize-phone";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

const TEN_MINUTES_MS = 10 * 60 * 1000;

// Per-IP and per-identifier limits on every unauthenticated credential endpoint.
// Sized to absorb a normal user's retry storm without giving an attacker enough
// budget to guess passwords or OTPs, or to enumerate accounts. Counts live in
// Redis (shared by every worker and task) and fall back to in-process counts.
// AUTH_RATE_LIMIT_SCALE multiplies every budget (the local demo stack raises it
// so repeated end-to-end runs do not lock the demo accounts out).
const limiter = (label: string, max: number) =>
  new RateLimiter({ label, max: Math.max(1, Math.round(max * config.AUTH_RATE_LIMIT_SCALE)), windowMs: TEN_MINUTES_MS });
const limits = {
  login: { ip: limiter("login-ip", 30), id: limiter("login-email", 10) },
  signup: { ip: limiter("signup-ip", 20), id: limiter("signup-email", 5) },
  google: { ip: limiter("google-ip", 30), id: null },
  otpSend: { ip: limiter("otp-send-ip", 30), id: limiter("otp-send-identifier", 5) },
  otpVerify: { ip: limiter("otp-verify-ip", 30), id: limiter("otp-verify-identifier", 10) },
  easyCheckout: { ip: limiter("easy-checkout-ip", 30), id: limiter("easy-checkout-identifier", 5) },
  forgotPassword: { ip: limiter("forgot-password-ip", 20), id: limiter("forgot-password-email", 5) },
  resetPassword: { ip: limiter("reset-password-ip", 20), id: null },
};

// req.ip honours the configured TRUST_PROXY hops, so a client cannot pick its
// own key by sending X-Forwarded-For.
function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "";
}

function tenantScopedKey(tenantId: string | undefined, value: string): string {
  return `${tenantId ?? "_"}::${value}`;
}

const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/** Identifiers a request is counted against (besides its IP). */
type Identify = (body: Record<string, unknown>) => string[];

const byEmail: Identify = (b) => (lower(b.email) ? [`email:${lower(b.email)}`] : []);
const byOtpIdentifier: Identify = (b) => {
  const channel = typeof b.channel === "string" ? b.channel : "";
  const raw = typeof b.identifier === "string" ? b.identifier : "";
  const id = channel === "whatsapp" ? normalizePhone(raw) : lower(raw);
  return id ? [`${channel}:${id}`] : [];
};
const byEmailAndPhone: Identify = (b) => {
  const phone = normalizePhone(typeof b.phone === "string" ? b.phone : undefined);
  return [...byEmail(b), ...(phone ? [`phone:${phone}`] : [])];
};

function rateLimit(limit: { ip: RateLimiter; id: RateLimiter | null }, identify?: Identify) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const tenantId = req.tenant?.id;
    const ip = clientIp(req);
    if (ip) await limit.ip.consume(tenantScopedKey(tenantId, `ip:${ip}`));
    if (limit.id && identify) {
      for (const id of identify((req.body ?? {}) as Record<string, unknown>)) {
        await limit.id.consume(tenantScopedKey(tenantId, id));
      }
    }
    next();
  });
}

const authRouter: Router = Router();

// Public auth config (no auth required)
authRouter.get("/config", asyncHandler(getAuthConfig));

// Email/password auth
authRouter.post("/signup", rateLimit(limits.signup, byEmail), asyncHandler(signup));
authRouter.post("/login", rateLimit(limits.login, byEmail), asyncHandler(login));

// Google OAuth
authRouter.post("/google", rateLimit(limits.google), asyncHandler(googleAuth));

// OTP
authRouter.post("/otp/send", rateLimit(limits.otpSend, byOtpIdentifier), asyncHandler(sendOtp));
authRouter.post("/otp/verify", rateLimit(limits.otpVerify, byOtpIdentifier), asyncHandler(verifyOtp));

// Easy Checkout (logged-out shoppers create an account from email + phone)
authRouter.post("/easy-checkout", rateLimit(limits.easyCheckout, byEmailAndPhone), asyncHandler(easyCheckoutSignup));

// Password reset (public)
authRouter.post("/forgot-password", rateLimit(limits.forgotPassword, byEmail), asyncHandler(forgotPassword));
authRouter.post("/reset-password", rateLimit(limits.resetPassword), asyncHandler(resetPassword));

// Authenticated member profile
authRouter.get("/me", asyncHandler(authenticateUser), asyncHandler(getMe));
authRouter.patch("/me", asyncHandler(authenticateUser), asyncHandler(updateProfile));
authRouter.delete("/me", asyncHandler(authenticateUser), asyncHandler(deleteMe));
authRouter.patch("/me/password", asyncHandler(authenticateUser), asyncHandler(changePassword));
authRouter.post("/me/avatar", upload.single("file"), asyncHandler(authenticateUser), asyncHandler(uploadAvatar));
authRouter.post("/me/send-verify-email-otp", asyncHandler(authenticateUser), asyncHandler(sendVerifyEmailOtp));
authRouter.post("/me/verify-email", asyncHandler(authenticateUser), asyncHandler(verifyEmail));
authRouter.post("/me/confirm-name/send-email-otp", asyncHandler(authenticateUser), asyncHandler(sendConfirmNameEmailOtp));
authRouter.post("/me/confirm-name", asyncHandler(authenticateUser), asyncHandler(confirmName));
authRouter.post("/logout", asyncHandler(authenticateUser), asyncHandler(logout));

export default authRouter;

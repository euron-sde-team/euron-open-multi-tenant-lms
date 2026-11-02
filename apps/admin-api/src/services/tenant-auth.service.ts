import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ulid } from "ulid";
import config from "../config";
import { db } from "../db/connection";
import { staff_membership_status, tenant_user_status } from "../db/enums";
import notificationService from "./notification.service";
import otpService from "./otp.service";
import geoService from "./geo.service";
import tenantAuditService from "./tenant-audit.service";
import tenantOrgS3Service from "./tenant-org.s3.service";
import logger from "../utils/logger";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import passwordResetRepository from "../repositories/password-reset.repository";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantUserRepository from "../repositories/tenant-user.repository";
import loginEventsRepository from "../repositories/login-events.repository";
import {
  LoginResponse,
  RequestMeta,
  SignupData,
  SignupResponse,
  TenantJwtPayload,
  TokenType,
  UserProfile,
} from "../types/auth.type";

const SALT_ROUNDS = 12;

// E.164 format: leading + followed by 7-15 digits, first digit 1-9.
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, "");
}

/**
 * Extract S3 key from a value that may be a full URL or already a key.
 * Full URLs look like https://bucket.s3.region.amazonaws.com/key
 */
function resolveAvatarKey(avatarUrl: string): string {
  if (!avatarUrl.startsWith("http")) return avatarUrl;
  try {
    return new URL(avatarUrl).pathname.substring(1); // strip leading /
  } catch {
    return avatarUrl;
  }
}

class TenantAuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token for tenant user
   */
  generateToken(payload: TenantJwtPayload): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): TenantJwtPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as TenantJwtPayload;

      if (decoded.type !== TokenType.TENANT) {
        throw new UnauthorizedError("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  /**
   * Signup - create new tenant user account (no tenant creation)
   */
  async signup(data: SignupData, meta?: RequestMeta): Promise<SignupResponse> {
    const { email, password, name: rawName, phone: phoneRaw } = data;

    // Validate required fields. Name is optional in the lean-signup flow.
    // we derive a default from the email local-part so tenant_users.name is
    // never null. The user can update it later from the dashboard / wizard.
    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }
    const name =
      rawName && rawName.trim().length > 0
        ? rawName.trim()
        : (email.split("@")[0] ?? "User");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError("Invalid email format");
    }

    // Validate password length
    if (password.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    // Phone is optional; when given it must be E.164. It is stored unverified.
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phone && !PHONE_RE.test(phone)) {
      throw new BadRequestError("Phone number must be in E.164 format (e.g. +919876543210)");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const emailExists = await tenantUserRepository.emailExists(normalizedEmail);
    if (emailExists) {
      throw new ConflictError("Email already registered");
    }

    // Phone must not be linked to another account (DB unique constraint is the
    // authoritative safety net, this pre-check gives a friendlier error)
    const phoneOwner = phone ? await tenantUserRepository.findByPhone(phone) : undefined;
    if (phoneOwner) {
      throw new ConflictError("This phone number is already linked to another account");
    }

    const now = new Date();
    const userId = ulid();

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Geo-enrich IP (non-blocking)
    let signupCountry: string | null = null;
    let signupCity: string | null = null;
    if (meta?.ip) {
      try {
        const geo = await geoService.getGeoFromIp(meta.ip);
        signupCountry = geo.country;
        signupCity = geo.city;
      } catch (err) {
        logger.warn(`Geo lookup failed during signup: ${(err as Error).message}`);
      }
    }

    // Create user with geo/metadata
    const user = await tenantUserRepository.create({
      id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
      name: name.trim(),
      status: tenant_user_status.ACTIVE,
      email_verified: false,
      phone,
      phone_verified: false,
      created_at: now,
      updated_at: now,
      signup_ip: meta?.ip || null,
      signup_country: signupCountry,
      signup_city: signupCity,
      signup_user_agent: meta?.userAgent || null,
      signup_referrer: meta?.referrer || null,
      signup_utm: meta?.utm ? JSON.stringify(meta.utm) : null,
      timezone: meta?.timezone || null,
    });

    // Fire-and-forget: send welcome email
    notificationService
      .sendTenantAdminWelcomeEmail(user.id, user.email, user.name)
      .catch((err) => logger.warn(`Welcome email failed: ${(err as Error).message}`));

    // Generate JWT token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      type: TokenType.TENANT,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Login tenant user with email and password
   */
  async login(email: string, password: string, meta?: RequestMeta): Promise<LoginResponse> {
    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const user = await tenantUserRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!user.password_hash) {
      throw new UnauthorizedError("Password login not available for this account");
    }

    if (user.status !== tenant_user_status.ACTIVE) {
      throw new UnauthorizedError("Account is not active");
    }

    const isPasswordValid = await this.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Update login metadata (login_count + last_login_ip + last_login_at)
    await tenantUserRepository.updateLoginMetadata(user.id, {
      last_login_ip: meta?.ip,
    });

    // Update geo location on every login so signup_country/city reflect current location
    if (meta?.ip) {
      try {
        const geo = await geoService.getGeoFromIp(meta.ip);
        await tenantUserRepository.update(user.id, {
          signup_ip: meta.ip,
          signup_country: geo.country,
          signup_city: geo.city,
          signup_user_agent: meta.userAgent || null,
          timezone: meta.timezone || null,
        });
      } catch (err) {
        logger.warn(`Geo update failed for user ${user.id}: ${(err as Error).message}`);
      }
    }

    // Fire-and-forget: record a detailed login event (never blocks login)
    void (async () => {
      const ua = meta?.userAgent || "";
      const [geo, tenantId] = await Promise.all([
        meta?.ip
          ? geoService.getFullGeoFromIp(meta.ip)
          : Promise.resolve({ country: null, region: null, city: null, timezone: null }),
        loginEventsRepository.firstActiveTenantForUser(user.id),
      ]);
      const dev = ua
        ? geoService.parseUserAgent(ua)
        : { device: null, browser: null, os: null };
      await loginEventsRepository.record({
        tenant_id: tenantId,
        principal_type: "STAFF",
        principal_id: user.id,
        email: user.email,
        ip_address: meta?.ip ?? null,
        user_agent: ua || null,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone || meta?.timezone || null,
        device: dev.device,
        browser: dev.browser,
        os: dev.os,
        login_method: "EMAIL_PASSWORD",
      });
    })();

    // Fire-and-forget: the sign-in also belongs in each org's Activity Log.
    // login_events above is the platform's record; owners never see it, and
    // "my new admin logged in and nothing shows" was the support ticket.
    void (async () => {
      const memberships =
        await tenantMembershipRepository.findByUserIdWithTenants(user.id);
      await tenantAuditService.recordLogin({
        tenantIds: memberships
          .filter((m) => m.status === staff_membership_status.ACTIVE)
          .map((m) => m.tenant_id),
        actor: { id: user.id, email: user.email, name: user.name },
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent || null,
      });
    })().catch((err) => {
      logger.warn(`Activity log sign-in entry failed for user ${user.id}: ${(err as Error).message}`);
    });

    // Generate JWT token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      type: TokenType.TENANT,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Get current user profile with tenant memberships
   */
  async getMe(userId: string): Promise<UserProfile> {
    const user = await tenantUserRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Get all tenant memberships
    const memberships = await tenantMembershipRepository.findByUserIdWithTenants(userId);

    // Resolve avatar URL: if it's an S3 key (not a full URL), prepend the bucket URL
    let avatarUrl = user.avatar_url;
    if (avatarUrl && !avatarUrl.startsWith("http")) {
      avatarUrl = tenantOrgS3Service.getPublicUrl(avatarUrl);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: avatarUrl,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      phone: user.phone,
      phone_verified: user.phone_verified,
      designation: user.designation,
      profile_completed_at: user.profile_completed_at,
      tenants: memberships.map((m) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        status: m.status,
        is_owner: m.is_owner,
        joined_at: m.joined_at,
      })),
    };
  }

  /**
   * Send a one-time code to the signed-in user's email address.
   */
  async sendVerifyEmailOtp(userId: string): Promise<void> {
    const user = await tenantUserRepository.findById(userId);
    if (!user || user.status !== tenant_user_status.ACTIVE) {
      throw new UnauthorizedError("User not found or inactive");
    }
    if (user.email_verified) {
      throw new BadRequestError("Email is already verified");
    }
    await otpService.sendOtp(userId, user.email, "email");
  }

  /**
   * Verify the emailed code and mark the user's email as verified.
   */
  async verifyEmailOtp(userId: string, code: string): Promise<UserProfile> {
    if (!code) {
      throw new BadRequestError("Verification code is required");
    }
    const user = await tenantUserRepository.findById(userId);
    if (!user || user.status !== tenant_user_status.ACTIVE) {
      throw new UnauthorizedError("User not found or inactive");
    }
    await otpService.verifyOtp(userId, user.email, "email", code);
    await tenantUserRepository.update(userId, { email_verified: true });
    return this.getMe(userId);
  }

  /**
   * Update user profile (name, designation, avatar_url)
   */
  async updateProfile(
    userId: string,
    data: {
      name?: string;
      designation?: string;
      avatar_url?: string | null;
      phone?: string | null;
    }
  ): Promise<UserProfile> {
    const updateData: Record<string, unknown> = {};

    // Phone is a plain profile field (no OTP); it is stored unverified.
    if (data.phone !== undefined) {
      const phone = data.phone ? normalizePhone(data.phone) : null;
      if (phone && !PHONE_RE.test(phone)) {
        throw new BadRequestError("Phone number must be in E.164 format (e.g. +919876543210)");
      }
      if (phone) {
        const owner = await tenantUserRepository.findByPhone(phone);
        if (owner && owner.id !== userId) {
          throw new ConflictError("This phone number is already linked to another account");
        }
      }
      updateData.phone = phone;
      updateData.phone_verified = false;
    }

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new BadRequestError("Name cannot be empty");
      }
      updateData.name = trimmed;
    }

    if (data.designation !== undefined) {
      updateData.designation = data.designation || null;
    }

    if (data.avatar_url !== undefined) {
      updateData.avatar_url = data.avatar_url;
    }

    // Set profile_completed_at if designation is provided
    if (data.designation) {
      updateData.profile_completed_at = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await tenantUserRepository.update(userId, updateData as Parameters<typeof tenantUserRepository.update>[1]);
    }

    return this.getMe(userId);
  }

  /**
   * Upload user avatar to S3 and update the user record
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File
  ): Promise<UserProfile> {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestError("Invalid file type. Allowed: JPEG, PNG, WebP");
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new BadRequestError("File too large. Maximum size is 5 MB");
    }

    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Delete old avatar from S3 if it exists
    if (user.avatar_url) {
      try {
        await tenantOrgS3Service.deleteFile(resolveAvatarKey(user.avatar_url));
      } catch {
        // Non-critical, old file may already be gone
        logger.warn(`Failed to delete old avatar for user ${userId}`);
      }
    }

    // Upload new avatar
    const ext = file.mimetype.split("/")[1] || "jpg";
    const key = await tenantOrgS3Service.uploadUserFile(
      userId,
      `avatar-${Date.now()}.${ext}`,
      file.buffer,
      file.mimetype
    );

    // Store the S3 key (not the full URL) so URL generation stays consistent
    await tenantUserRepository.update(userId, { avatar_url: key } as Parameters<typeof tenantUserRepository.update>[1]);

    return this.getMe(userId);
  }

  /**
   * Remove user avatar
   */
  async removeAvatar(userId: string): Promise<UserProfile> {
    const user = await tenantUserRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (user.avatar_url) {
      try {
        await tenantOrgS3Service.deleteFile(resolveAvatarKey(user.avatar_url));
      } catch {
        logger.warn(`Failed to delete avatar for user ${userId}`);
      }
    }

    await tenantUserRepository.update(userId, { avatar_url: null } as Parameters<typeof tenantUserRepository.update>[1]);

    return this.getMe(userId);
  }

  /**
   * Forgot password, generate reset token and send email
   * Always returns success to prevent email enumeration
   */
  async forgotPassword(email: string, frontendBaseUrl: string): Promise<void> {
    if (!email) {
      throw new BadRequestError("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await tenantUserRepository.findByEmail(normalizedEmail);

    // Silently return if user not found or not active (prevent enumeration)
    if (!user || user.status !== tenant_user_status.ACTIVE) {
      logger.warn(`[forgot-password] Skipped: user not found or not active for email=${normalizedEmail} status=${user?.status ?? "NOT_FOUND"}`);
      return;
    }

    // Resolve tenant_id: check staff membership first, then owned tenant
    const membership = await tenantMembershipRepository.findByUserIdWithTenants(user.id);
    let tenantId: string | null = null;

    if (membership.length > 0) {
      tenantId = membership[0].tenant_id;
    } else {
      const ownedTenant = await db
        .selectFrom("tenants")
        .select("id")
        .where("owner_user_id", "=", user.id)
        .executeTakeFirst();
      tenantId = ownedTenant?.id ?? null;
    }

    if (!tenantId) {
      logger.info(`[forgot-password] No tenant association for userId=${user.id} email=${normalizedEmail}, proceeding without tenant`);
    }

    // Clean up expired tokens for this email
    await passwordResetRepository.deleteExpiredForEmail(normalizedEmail);

    // Generate token and store
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await passwordResetRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      email: normalizedEmail,
      token,
      expires_at: expiresAt,
    });

    // Build reset link and send email (fire-and-forget)
    const resetLink = `${frontendBaseUrl}/reset-password/${token}`;
    logger.info(`[forgot-password] Reset token created for email=${normalizedEmail} tenantId=${tenantId} resetLink=${resetLink}`);

    notificationService
      .sendPasswordResetEmail(normalizedEmail, user.name, resetLink, 15)
      .then(() => {
        logger.info(`[forgot-password] Email sent successfully to=${normalizedEmail}`);
      })
      .catch((err) => {
        logger.error(`[forgot-password] Email FAILED to=${normalizedEmail} resetLink=${resetLink} error=${(err as Error).message}`, {
          stack: (err as Error).stack,
        });
      });
  }

  /**
   * Reset password using a valid token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new BadRequestError("Token and new password are required");
    }

    if (newPassword.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters long");
    }

    const resetRecord = await passwordResetRepository.findValidByToken(token);
    if (!resetRecord) {
      throw new BadRequestError("Invalid or expired reset link");
    }

    const user = await tenantUserRepository.findByEmail(resetRecord.email);
    if (!user) {
      throw new BadRequestError("Invalid or expired reset link");
    }

    const passwordHash = await this.hashPassword(newPassword);
    await tenantUserRepository.updatePassword(user.id, passwordHash);
    await passwordResetRepository.markUsed(resetRecord.id);
  }
}

export default new TenantAuthService();

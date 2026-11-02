import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ulid } from "ulid";
import config from "../config";
import authRepository from "../repositories/auth.repository";
import authConfigRepository from "../repositories/auth-config.repository";
import passwordResetRepository from "../repositories/password-reset.repository";
import tenantOrgRepository from "../repositories/tenant-org.repository";
import sessionRepository from "../repositories/session.repository";
import * as s3Service from "./s3.service";
import otpService from "./otp.service";
import sessionService from "./session.service";
import googleOAuthService from "./google-oauth.service";
import emailService from "./email.service";
import { queueNotification } from "../queues/notification.queue";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { assertMemberActive } from "../utils/member-status.util";
import logger from "../utils/logger";
import { normalizePhone, isValidNormalizedPhone } from "../utils/normalize-phone";
import type {
  AuthConfigPublic,
  AuthResponse,
  MemberPublic,
  JwtPayload,
  SignupRequest,
  LoginRequest,
  GoogleAuthRequest,
  OtpSendRequest,
  OtpVerifyRequest,
  EasyCheckoutSignupRequest,
} from "../types/auth.type";
import { LEARNER_TOKEN_TYPE } from "../types/auth.type";

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_MINUTES = 15;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_AUTH_CONFIG: AuthConfigPublic = {
  emailPasswordEnabled: true,
  googleOauthEnabled: false,
  emailOtpEnabled: false,
  phoneOtpEnabled: false,
  signupEnabled: true,
  autoSignupOnLogin: false,
  phoneNumberRequired: false,
  easyCheckoutEnabled: false,
  nameConfirmationEnabled: false,
  googleClientId: null,
};

class AuthService {
  /**
   * Get public auth config for a tenant (used by frontend to render auth UI).
   */
  async getAuthConfig(tenantId: string): Promise<AuthConfigPublic> {
    const row = await authConfigRepository.findByTenantId(tenantId);

    if (!row) {
      return DEFAULT_AUTH_CONFIG;
    }

    return {
      emailPasswordEnabled: row.email_password_enabled,
      googleOauthEnabled: row.google_oauth_enabled,
      emailOtpEnabled: row.email_otp_enabled,
      phoneOtpEnabled: row.phone_otp_enabled,
      signupEnabled: row.signup_enabled,
      autoSignupOnLogin: row.auto_signup_on_login,
      phoneNumberRequired: (row as { phone_number_required?: boolean }).phone_number_required ?? false,
      easyCheckoutEnabled: (row as { easy_checkout_enabled?: boolean }).easy_checkout_enabled ?? false,
      nameConfirmationEnabled: (row as { name_confirmation_enabled?: boolean }).name_confirmation_enabled ?? false,
      googleClientId: row.google_client_id ?? null,
    };
  }

  /**
   * Email/password signup.
   */
  async signup(tenantId: string, data: SignupRequest, deviceInfo?: string): Promise<AuthResponse> {
    const authConfig = await this.getAuthConfig(tenantId);

    if (!authConfig.emailPasswordEnabled) {
      throw new BadRequestError("Email/password authentication is not enabled");
    }

    if (!authConfig.signupEnabled) {
      throw new BadRequestError("Signup is not enabled");
    }

    if (!data.email || !data.password || !data.name) {
      throw new BadRequestError("Email, password, and name are required");
    }

    if (data.password.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const existing = await authRepository.findByEmailAndTenant(data.email.toLowerCase(), tenantId);
    if (existing) {
      throw new BadRequestError("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const member = await authRepository.createMember({
      id: ulid(),
      tenant_id: tenantId,
      email: data.email.toLowerCase(),
      name: data.name,
      password_hash: passwordHash,
    });


    // Fire-and-forget: welcome notification
    queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});

    await authRepository.updateLastLogin(member.id);

    const sessionToken = await sessionService.createSession(tenantId, member.id, deviceInfo);
    const token = this.generateToken({ id: member.id, type: LEARNER_TOKEN_TYPE, tenantId, email: member.email ?? "", sessionToken });

    return {
      accessToken: token,
      member: this.mapMemberToPublic(member),
    };
  }

  /**
   * Email/password login.
   */
  async login(
    tenantId: string,
    data: LoginRequest,
    deviceInfo?: string,
    _ip?: string | null
  ): Promise<AuthResponse> {
    const authConfig = await this.getAuthConfig(tenantId);

    if (!authConfig.emailPasswordEnabled) {
      throw new BadRequestError("Email/password authentication is not enabled");
    }

    if (!data.email || !data.password) {
      throw new BadRequestError("Email and password are required");
    }

    const email = data.email.toLowerCase();
    let member = await authRepository.findByEmailAndTenant(email, tenantId);

    if (!member) {
      // Auto-signup on first login if configured
      if (authConfig.autoSignupOnLogin) {
        const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
        member = await authRepository.createMember({
          id: ulid(),
          tenant_id: tenantId,
          email,
          name: email.split("@")[0],
          password_hash: passwordHash,
        });


        // Fire-and-forget: welcome notification
        queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});
      } else {
        throw new UnauthorizedError("Invalid email or password");
      }
    } else {
      if (!member.password_hash) {
        throw new BadRequestError("This account uses a different sign-in method");
      }

      const isValid = await bcrypt.compare(data.password, member.password_hash);
      if (!isValid) {
        throw new UnauthorizedError("Invalid email or password");
      }

      assertMemberActive(member.status);
    }

    await authRepository.updateLastLogin(member.id);


    const sessionToken = await sessionService.createSession(tenantId, member.id, deviceInfo);
    const token = this.generateToken({ id: member.id, type: LEARNER_TOKEN_TYPE, tenantId, email: member.email ?? "", sessionToken });

    return {
      accessToken: token,
      member: this.mapMemberToPublic(member),
    };
  }

  /**
   * Google OAuth login/signup.
   */
  async googleAuth(tenantId: string, data: GoogleAuthRequest, deviceInfo?: string): Promise<AuthResponse> {
    const authConfig = await this.getAuthConfig(tenantId);

    if (!authConfig.googleOauthEnabled) {
      throw new BadRequestError("Google OAuth is not enabled");
    }

    if (!data.googleToken && !data.googleAccessToken) {
      throw new BadRequestError("Google token is required");
    }

    // Fetch tenant's Google Client ID for audience verification
    const configRow = await authConfigRepository.findByTenantId(tenantId);
    const tenantGoogleClientId = configRow?.google_client_id;
    if (!tenantGoogleClientId) {
      logger.error("Google OAuth is not properly configured for this platform: missing google_client_id");
      throw new BadRequestError("Google sign-in is not available. Please use email login.");
    }

    // Verify either ID token (GIS button) or access token (OAuth popup)
    const googleUser = data.googleToken
      ? await googleOAuthService.verifyToken(data.googleToken, tenantGoogleClientId)
      : await googleOAuthService.verifyAccessToken(data.googleAccessToken!, tenantGoogleClientId);

    if (!googleUser.email) {
      throw new BadRequestError("Could not retrieve email from Google");
    }

    const email = googleUser.email.toLowerCase();
    let member = await authRepository.findByEmailAndTenant(email, tenantId);

    if (!member) {
      if (!authConfig.signupEnabled && !authConfig.autoSignupOnLogin) {
        throw new UnauthorizedError("Signup is not enabled. Contact the administrator.");
      }

      member = await authRepository.createMember({
        id: ulid(),
        tenant_id: tenantId,
        email,
        name: googleUser.name || googleUser.given_name || email.split("@")[0],
        avatar_url: googleUser.picture || null,
        oauth_provider: "GOOGLE",
        oauth_provider_id: googleUser.sub,
        email_verified: true,
      });


      // Fire-and-forget: welcome notification
      queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});
    } else {
      assertMemberActive(member.status);

      // Link Google OAuth if not already linked
      if (!member.oauth_provider) {
        await authRepository.updateOAuthProvider(member.id, "GOOGLE", googleUser.sub);
      }

      if (!member.email_verified) {
        await authRepository.setEmailVerified(member.id);
      }
    }

    await authRepository.updateLastLogin(member.id);

    const sessionToken = await sessionService.createSession(tenantId, member.id, deviceInfo);
    const token = this.generateToken({ id: member.id, type: LEARNER_TOKEN_TYPE, tenantId, email: member.email ?? "", sessionToken });

    return {
      accessToken: token,
      member: this.mapMemberToPublic(member),
    };
  }

  /**
   * Send OTP to email or phone.
   */
  async sendOtp(
    tenantId: string,
    tenantName: string,
    data: OtpSendRequest
  ): Promise<void> {
    const authConfig = await this.getAuthConfig(tenantId);

    if (data.channel === "email" && !authConfig.emailOtpEnabled) {
      throw new BadRequestError("Email OTP is not enabled");
    }

    if (data.channel === "whatsapp" && !authConfig.phoneOtpEnabled) {
      throw new BadRequestError("Phone OTP is not enabled");
    }

    if (!data.identifier) {
      throw new BadRequestError("Identifier (email or phone) is required");
    }

    // Canonicalize the identifier: emails are lowercased, phones are normalized
    // to digits-only so all formats of the same number map to a single OTP row.
    const identifier =
      data.channel === "whatsapp"
        ? normalizePhone(data.identifier)
        : data.identifier.toLowerCase();
    if (data.channel === "whatsapp" && !isValidNormalizedPhone(identifier)) {
      throw new BadRequestError("Valid phone number is required");
    }

    // Fetch tenant logo for branded emails
    let tenantLogoUrl: string | undefined;
    if (data.channel === "email") {
      const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
      if (orgDetails?.logo_light_key) {
        tenantLogoUrl = `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`;
      }
    }

    await otpService.sendOtp(tenantId, identifier, data.channel, tenantName, tenantLogoUrl);
  }

  /**
   * Verify OTP and login/signup.
   */
  async verifyOtp(tenantId: string, data: OtpVerifyRequest, deviceInfo?: string): Promise<AuthResponse> {
    const authConfig = await this.getAuthConfig(tenantId);

    if (data.channel === "email" && !authConfig.emailOtpEnabled) {
      throw new BadRequestError("Email OTP is not enabled");
    }

    if (data.channel === "whatsapp" && !authConfig.phoneOtpEnabled) {
      throw new BadRequestError("Phone OTP is not enabled");
    }

    if (!data.identifier || !data.code) {
      throw new BadRequestError("Identifier and code are required");
    }

    // Match the canonicalization used in sendOtp so the OTP row created by send
    // is the same row checked by verify.
    const identifier =
      data.channel === "whatsapp"
        ? normalizePhone(data.identifier)
        : data.identifier.toLowerCase();
    if (data.channel === "whatsapp" && !isValidNormalizedPhone(identifier)) {
      throw new BadRequestError("Valid phone number is required");
    }

    // Verify the OTP code
    await otpService.verifyOtp(tenantId, identifier, data.channel, data.code);

    // Find or create member based on channel
    let member;
    if (data.channel === "email") {
      member = await authRepository.findByEmailAndTenant(identifier, tenantId);

      if (!member) {
        if (!authConfig.signupEnabled && !authConfig.autoSignupOnLogin) {
          throw new UnauthorizedError("Signup is not enabled. Contact the administrator.");
        }

        member = await authRepository.createMember({
          id: ulid(),
          tenant_id: tenantId,
          email: identifier,
          name: data.name || identifier.split("@")[0],
          email_verified: true,
        });


        // Fire-and-forget: welcome notification
        queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});
      } else {
        if (!member.email_verified) {
          await authRepository.setEmailVerified(member.id);
        }
      }
    } else {
      // WhatsApp OTP, look up by phone (normalized to digits-only canonical form)
      const normalizedPhone = normalizePhone(identifier);
      member = await authRepository.findByPhoneAndTenant(normalizedPhone, tenantId);

      if (!member) {
        if (!authConfig.signupEnabled && !authConfig.autoSignupOnLogin) {
          throw new UnauthorizedError("Signup is not enabled. Contact the administrator.");
        }

        // For phone OTP, email is not available; use phone as identifier
        // Generate a placeholder email from the canonical (digits-only) phone form.
        const placeholderEmail = `${normalizedPhone}@phone.user`;
        member = await authRepository.createMember({
          id: ulid(),
          tenant_id: tenantId,
          email: placeholderEmail,
          name: data.name || identifier,
          phone: normalizedPhone,
          phone_verified: true,
        });


        // Fire-and-forget: welcome notification
        queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});
      } else {
        if (!member.phone_verified) {
          await authRepository.setPhoneVerified(member.id);
        }
      }
    }

    assertMemberActive(member.status);

    await authRepository.updateLastLogin(member.id);

    const sessionToken = await sessionService.createSession(tenantId, member.id, deviceInfo);
    const token = this.generateToken({ id: member.id, type: LEARNER_TOKEN_TYPE, tenantId, email: member.email ?? "", sessionToken });

    return {
      accessToken: token,
      member: this.mapMemberToPublic(member),
    };
  }

  /**
   * Easy Checkout signup. Atomic single round-trip: validate format → look up email and
   * phone in this tenant's members → if neither matches, create + log in (no verification).
   * If either identifier matches an existing member, send OTP and throw a structured
   * ConflictError so the modal can switch to OTP recovery without an extra roundtrip.
   */
  async easyCheckoutSignup(
    tenantId: string,
    tenantName: string,
    data: EasyCheckoutSignupRequest,
    deviceInfo?: string
  ): Promise<AuthResponse> {
    const cfg = await this.getAuthConfig(tenantId);
    if (!cfg.easyCheckoutEnabled) {
      throw new BadRequestError("Easy Checkout is not enabled");
    }

    const email = (data.email ?? "").trim().toLowerCase();
    const phone = normalizePhone(data.phone);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError("Valid email is required");
    }
    if (!isValidNormalizedPhone(phone)) {
      throw new BadRequestError("Valid phone number is required");
    }
    const name = (data.name ?? "").trim();
    if (!name) {
      throw new BadRequestError("Name is required");
    }

    const [byEmail, byPhone] = await Promise.all([
      authRepository.findByEmailAndTenant(email, tenantId),
      authRepository.findByPhoneAndTenant(phone, tenantId),
    ]);

    // Diagnostic: temporarily verbose so a user reporting "I used a fresh email but got
    // OTP" can see exactly what the backend matched on. Strip once dialled in.
    logger.info(
      `[easy-checkout] tenant=${tenantId} email=${email} phone=${phone} byEmailId=${byEmail?.id ?? "none"} byPhoneId=${byPhone?.id ?? "none"}`
    );

    if (byEmail || byPhone) {
      // Prefer email match for OTP delivery (no SMS cost, faster). Phone collision
      // on a different account is intentionally not surfaced to avoid enumeration.
      const matched = byEmail
        ? { matchedIdentifier: email, channel: "email" as const }
        : { matchedIdentifier: phone, channel: "whatsapp" as const };

      let tenantLogoUrl: string | undefined;
      if (matched.channel === "email") {
        const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
        if (orgDetails?.logo_light_key) {
          tenantLogoUrl = `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`;
        }
      }
      try {
        await otpService.sendOtp(tenantId, matched.matchedIdentifier, matched.channel, tenantName, tenantLogoUrl);
      } catch (e) {
        // OTP send failure (rate limit, provider outage) shouldn't drop the conflict signal.
        // The frontend can re-trigger send from the OTP view.
        logger.warn(`Easy Checkout OTP pre-send failed: ${(e as Error).message}`);
      }
      throw new ConflictError(JSON.stringify({ kind: "EASY_CHECKOUT_CONFLICT", ...matched }));
    }

    // Account auto-created via Easy Checkout. No password is set; the member can log in
    // later via Email OTP or Phone OTP, at which point those flags will be set true by
    // the OTP verification flow. Until then, both stay false, the EmailVerificationGuard
    // suppression is what prevents the verify-now nag (see EmailVerificationGuard).
    // We tag the row in profile_metadata so analytics and support can identify the source.
    const member = await authRepository.createMember({
      id: ulid(),
      tenant_id: tenantId,
      email,
      phone,
      name,
      // The user typed their name here, so it is already confirmed, do not
      // pop the one-time name confirmation modal over the checkout afterwards.
      name_confirmed_at: new Date(),
      profile_metadata: JSON.stringify({ signupSource: "EASY_CHECKOUT" }),
    });


    queueNotification({ type: "user-welcome", tenantId, memberId: member.id }).catch(() => {});

    await authRepository.updateLastLogin(member.id);

    const sessionToken = await sessionService.createSession(tenantId, member.id, deviceInfo);
    const token = this.generateToken({ id: member.id, type: LEARNER_TOKEN_TYPE, tenantId, email: member.email ?? "", sessionToken });

    return {
      accessToken: token,
      member: this.mapMemberToPublic(member),
    };
  }

  /**
   * Initiate password reset, sends email with reset link.
   * Always returns success (prevents email enumeration).
   */
  async forgotPassword(
    tenantId: string,
    email: string,
    tenantName: string,
    frontendBaseUrl: string
  ): Promise<void> {
    const authConfig = await this.getAuthConfig(tenantId);
    if (!authConfig.emailPasswordEnabled) {
      return; // Silent, no enumeration
    }

    const normalizedEmail = email.toLowerCase();
    const member = await authRepository.findByEmailAndTenant(normalizedEmail, tenantId);
    if (!member) {
      return; // Silent, no enumeration
    }

    // Clean up expired tokens first
    await passwordResetRepository.deleteExpiredForEmail(tenantId, normalizedEmail);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

    await passwordResetRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      email: normalizedEmail,
      token,
      expires_at: expiresAt,
    });

    // Fetch tenant logo for branded email
    let tenantLogoUrl: string | undefined;
    const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
    if (orgDetails?.logo_light_key) {
      tenantLogoUrl = `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`;
    }

    const resetLink = `${frontendBaseUrl}/reset-password/${token}`;
    await emailService.sendPasswordResetEmail(
      tenantId,
      normalizedEmail,
      resetLink,
      tenantName,
      tenantLogoUrl,
      PASSWORD_RESET_EXPIRY_MINUTES,
      token,
    );
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters");
    }

    const resetRecord = await passwordResetRepository.findValidByToken(token);
    if (!resetRecord || !resetRecord.tenant_id) {
      throw new BadRequestError("Invalid or expired reset link");
    }

    const member = await authRepository.findByEmailAndTenant(
      resetRecord.email,
      resetRecord.tenant_id
    );
    if (!member) {
      throw new BadRequestError("Invalid or expired reset link");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await authRepository.updatePassword(member.id, passwordHash);
    await passwordResetRepository.markUsed(resetRecord.id);

    // Deactivate all sessions for security, forces re-login after password reset
    await sessionRepository.deactivateAllForMember(resetRecord.tenant_id, member.id);
  }

  /**
   * Get current authenticated member.
   */
  async getMe(memberId: string): Promise<MemberPublic> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    return this.mapMemberToPublic(member);
  }

  /**
   * Update current member profile (name, phone, avatar, etc.).
   */
  async updateProfile(
    memberId: string,
    data: {
      name?: string;
      phone?: string;
      avatarUrl?: string;
      about?: string;
      gender?: string;
      profileMetadata?: Record<string, unknown>;
    }
  ): Promise<MemberPublic> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    assertMemberActive(member.status);

    // Deep merge new profile metadata with existing (so partial updates don't wipe other fields)
    let mergedMetadata = data.profileMetadata;
    if (mergedMetadata) {
      const existing = (member.profile_metadata as Record<string, unknown>) ?? {};
      mergedMetadata = { ...existing };
      for (const [key, value] of Object.entries(data.profileMetadata!)) {
        if (value && typeof value === "object" && !Array.isArray(value) && existing[key] && typeof existing[key] === "object" && !Array.isArray(existing[key])) {
          // Deep merge nested objects (e.g. socialLinks)
          mergedMetadata[key] = { ...(existing[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
        } else {
          mergedMetadata[key] = value;
        }
      }
    }

    const updated = await authRepository.updateProfile(memberId, {
      name: data.name,
      phone: data.phone,
      avatar_url: data.avatarUrl,
      about: data.about,
      gender: data.gender,
      profile_metadata: mergedMetadata ? JSON.stringify(mergedMetadata) : undefined,
    });
    return this.mapMemberToPublic(updated);
  }

  /**
   * Upload profile avatar and update member record.
   */
  async changePassword(memberId: string, currentPassword: string, newPassword: string): Promise<void> {
    const member = await authRepository.findById(memberId);
    if (!member) throw new UnauthorizedError("Member not found");
    if (!member.password_hash) throw new BadRequestError("No password set. Use forgot password to set one.");

    const isMatch = await bcrypt.compare(currentPassword, member.password_hash);
    if (!isMatch) throw new BadRequestError("Current password is incorrect");

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await authRepository.updatePassword(member.id, newHash);
  }

  async uploadAvatar(
    tenantId: string,
    memberId: string,
    file: Express.Multer.File
  ): Promise<MemberPublic> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    assertMemberActive(member.status);

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestError("Invalid file type. Allowed: PNG, JPEG, GIF, WebP");
    }

    const url = await s3Service.uploadProfileAvatar(tenantId, memberId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });

    const updated = await authRepository.updateProfile(memberId, { avatar_url: url });
    return this.mapMemberToPublic(updated);
  }

  /**
   * Send email verification OTP for an already-authenticated member.
   * No auth config check, this is email verification, not "email OTP login".
   */
  async sendVerifyEmailOtp(
    tenantId: string,
    tenantName: string,
    memberId: string
  ): Promise<void> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    if (!member.email) {
      throw new BadRequestError("No email address on this account");
    }
    if (member.email_verified) {
      throw new BadRequestError("Email is already verified");
    }

    // Fetch tenant logo for branded email
    let tenantLogoUrl: string | undefined;
    const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
    if (orgDetails?.logo_light_key) {
      tenantLogoUrl = `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`;
    }

    await otpService.sendOtp(tenantId, member.email, "email", tenantName, tenantLogoUrl);
  }

  /**
   * Verify email OTP and mark email as verified.
   */
  async verifyEmailAndUpdate(
    tenantId: string,
    memberId: string,
    code: string
  ): Promise<MemberPublic> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    assertMemberActive(member.status);
    if (!member.email) {
      throw new BadRequestError("No email address on this account");
    }
    if (member.email_verified) {
      throw new BadRequestError("Email is already verified");
    }

    await otpService.verifyOtp(tenantId, member.email, "email", code);
    await authRepository.setEmailVerified(member.id);

    const updated = await authRepository.findById(member.id);
    if (!updated) throw new UnauthorizedError("Member not found");
    return this.mapMemberToPublic(updated);
  }

  /**
   * Send an OTP to a NEW email a member wants to switch to via the name confirmation
   * modal. Only offered when the current email is a phone-derived placeholder
   * (`<phone>@phone.user`), i.e. the member signed up by phone and never had a real
   * email. The code is delivered to the proposed new address so we prove ownership
   * before saving it.
   */
  async sendConfirmNameEmailOtp(
    tenantId: string,
    tenantName: string,
    memberId: string,
    newEmail: string
  ): Promise<void> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    assertMemberActive(member.status);
    if (!this.isPhoneDerivedEmail(member.email)) {
      throw new BadRequestError("Email can only be changed for phone based accounts");
    }

    const email = (newEmail ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestError("Valid email is required");
    }
    if (email === (member.email ?? "").toLowerCase()) {
      throw new BadRequestError("Enter a new email address");
    }

    const existing = await authRepository.findByEmailAndTenant(email, tenantId);
    if (existing && existing.id !== memberId) {
      throw new ConflictError("This email is already linked to another account");
    }

    let tenantLogoUrl: string | undefined;
    const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
    if (orgDetails?.logo_light_key) {
      tenantLogoUrl = `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`;
    }

    await otpService.sendOtp(tenantId, email, "email", tenantName, tenantLogoUrl);
  }

  /**
   * One-time confirmation from the name confirmation modal: always saves the (possibly
   * edited) name and stamps `name_confirmed_at` so the modal never shows again. If the
   * member also changed a phone-derived placeholder email to a real one, the new email
   * is verified via OTP first, then saved and marked verified. Best-effort email change
   * never blocks the name confirmation.
   */
  async confirmName(
    tenantId: string,
    memberId: string,
    data: { name: string; email?: string | null; code?: string | null }
  ): Promise<MemberPublic> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    assertMemberActive(member.status);

    const name = (data.name ?? "").trim();
    if (!name) {
      throw new BadRequestError("Name is required");
    }
    if (name.length > 100) {
      throw new BadRequestError("Name must be 100 characters or fewer");
    }

    const requestedEmail = (data.email ?? "").trim().toLowerCase();
    const wantsEmailChange =
      requestedEmail.length > 0 && requestedEmail !== (member.email ?? "").toLowerCase();

    if (wantsEmailChange) {
      if (!this.isPhoneDerivedEmail(member.email)) {
        throw new BadRequestError("Email can only be changed for phone based accounts");
      }
      if (!EMAIL_REGEX.test(requestedEmail)) {
        throw new BadRequestError("Valid email is required");
      }
      if (!data.code) {
        throw new BadRequestError("Verification code is required to change email");
      }

      const existing = await authRepository.findByEmailAndTenant(requestedEmail, tenantId);
      if (existing && existing.id !== memberId) {
        throw new ConflictError("This email is already linked to another account");
      }

      await otpService.verifyOtp(tenantId, requestedEmail, "email", data.code);
      await authRepository.updateEmailAndVerify(memberId, requestedEmail);
    }

    await authRepository.markNameConfirmed(memberId, name);

    const updated = await authRepository.findById(memberId);
    if (!updated) throw new UnauthorizedError("Member not found");
    return this.mapMemberToPublic(updated);
  }

  /** Placeholder emails minted for phone-first signups look like `<digits>@phone.user`. */
  private isPhoneDerivedEmail(email: string | null | undefined): boolean {
    return !!email && email.toLowerCase().endsWith("@phone.user");
  }

  /**
   * Delete (deactivate) current member account.
   */
  async deleteProfile(memberId: string): Promise<void> {
    const member = await authRepository.findById(memberId);
    if (!member) {
      throw new UnauthorizedError("Member not found");
    }
    await authRepository.deactivateMember(memberId);
  }

  private generateToken(payload: JwtPayload): string {
    // Parse JWT_EXPIRY to seconds for jsonwebtoken v9 compatibility
    const expiryStr = config.JWT_EXPIRY;
    let expiresInSeconds: number;
    const match = expiryStr.match(/^(\d+)([dhms])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      expiresInSeconds = value * (multipliers[unit] || 86400);
    } else {
      expiresInSeconds = 30 * 86400; // Default 30 days
    }

    return jwt.sign(payload, config.LEARNER_JWT_SECRET, {
      expiresIn: expiresInSeconds,
    });
  }

  private mapMemberToPublic(member: {
    id: string;
    tenant_id: string;
    email: string | null;
    name: string;
    phone: string | null;
    avatar_url: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    status: string;
    name_confirmed_at?: Date | null;
    about?: string | null;
    gender?: string | null;
    oauth_provider?: string | null;
    profile_metadata?: unknown | null;
  }): MemberPublic {
    return {
      id: member.id,
      tenantId: member.tenant_id,
      email: member.email ?? "",
      name: member.name,
      phone: member.phone,
      avatarUrl: member.avatar_url,
      emailVerified: member.email_verified,
      phoneVerified: member.phone_verified,
      status: member.status,
      nameConfirmedAt: member.name_confirmed_at ? new Date(member.name_confirmed_at).toISOString() : null,
      about: (member as { about?: string | null }).about,
      gender: (member as { gender?: string | null }).gender,
      oauthProvider: member.oauth_provider ?? null,
      profileMetadata: (member.profile_metadata as Record<string, unknown>) ?? null,
    };
  }
}

export default new AuthService();

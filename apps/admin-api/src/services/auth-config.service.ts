import { ulid } from "ulid";
import authConfigRepository from "../repositories/auth-config.repository";
import { BadRequestError } from "../errors/bad-request.error";
import type { AuthConfigResponse, SaveGoogleClientIdRequest, UpdateAuthConfigRequest } from "../types/auth-config.type";

const DEFAULT_CONFIG: Omit<AuthConfigResponse, "id" | "tenantId" | "createdAt" | "updatedAt" | "warnings"> = {
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

interface MergedConfig {
  emailPasswordEnabled: boolean;
  googleOauthEnabled: boolean;
  emailOtpEnabled: boolean;
  phoneOtpEnabled: boolean;
  signupEnabled: boolean;
  autoSignupOnLogin: boolean;
  phoneNumberRequired: boolean;
  easyCheckoutEnabled: boolean;
  nameConfirmationEnabled: boolean;
  googleClientId: string | null;
}

class AuthConfigService {
  async getAuthConfig(tenantId: string): Promise<AuthConfigResponse> {
    const row = await authConfigRepository.findByTenantId(tenantId);

    if (!row) {
      return {
        id: "",
        tenantId,
        ...DEFAULT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.mapRowToResponse(row);
  }

  async updateAuthConfig(tenantId: string, data: UpdateAuthConfigRequest): Promise<AuthConfigResponse> {
    const currentRow = await authConfigRepository.findByTenantId(tenantId);

    const baseline: MergedConfig = currentRow
      ? {
          emailPasswordEnabled: currentRow.email_password_enabled,
          googleOauthEnabled: currentRow.google_oauth_enabled,
          emailOtpEnabled: currentRow.email_otp_enabled,
          phoneOtpEnabled: currentRow.phone_otp_enabled,
          signupEnabled: currentRow.signup_enabled,
          autoSignupOnLogin: currentRow.auto_signup_on_login,
          phoneNumberRequired: currentRow.phone_number_required ?? false,
          easyCheckoutEnabled: currentRow.easy_checkout_enabled ?? false,
          nameConfirmationEnabled: currentRow.name_confirmation_enabled ?? false,
          googleClientId: currentRow.google_client_id ?? null,
        }
      : { ...DEFAULT_CONFIG };

    const merged: MergedConfig = {
      emailPasswordEnabled: data.emailPasswordEnabled ?? baseline.emailPasswordEnabled,
      googleOauthEnabled: data.googleOauthEnabled ?? baseline.googleOauthEnabled,
      emailOtpEnabled: data.emailOtpEnabled ?? baseline.emailOtpEnabled,
      phoneOtpEnabled: data.phoneOtpEnabled ?? baseline.phoneOtpEnabled,
      signupEnabled: data.signupEnabled ?? baseline.signupEnabled,
      autoSignupOnLogin: data.autoSignupOnLogin ?? baseline.autoSignupOnLogin,
      phoneNumberRequired: data.phoneNumberRequired ?? baseline.phoneNumberRequired,
      easyCheckoutEnabled: data.easyCheckoutEnabled ?? baseline.easyCheckoutEnabled,
      nameConfirmationEnabled: data.nameConfirmationEnabled ?? baseline.nameConfirmationEnabled,
      googleClientId: baseline.googleClientId,
    };

    if (data.googleOauthEnabled === true && !merged.googleClientId) {
      throw new BadRequestError("Configure Google OAuth Client ID before enabling");
    }

    if (
      (data.emailOtpEnabled === false || data.phoneOtpEnabled === false) &&
      merged.easyCheckoutEnabled === true
    ) {
      throw new BadRequestError(
        "Disable Easy Checkout before turning off Email OTP or Phone OTP. Easy Checkout creates accounts that can only log back in via OTP."
      );
    }

    const warnings: string[] = [];

    if (merged.easyCheckoutEnabled === true) {
      if (!merged.emailOtpEnabled) {
        merged.emailOtpEnabled = true;
        warnings.push(
          "Email OTP was enabled because Easy Checkout requires it for account recovery."
        );
      }
      if (!merged.phoneOtpEnabled) {
        merged.phoneOtpEnabled = true;
        warnings.push(
          "Phone OTP was enabled because Easy Checkout requires it for account recovery."
        );
      }
    }

    const hasAtLeastOneMethod =
      merged.emailPasswordEnabled ||
      merged.googleOauthEnabled ||
      merged.emailOtpEnabled ||
      merged.phoneOtpEnabled;

    if (!hasAtLeastOneMethod) {
      throw new BadRequestError("At least one authentication method must be enabled");
    }

    const row = await authConfigRepository.upsert(ulid(), tenantId, {
      email_password_enabled: merged.emailPasswordEnabled,
      google_oauth_enabled: merged.googleOauthEnabled,
      email_otp_enabled: merged.emailOtpEnabled,
      phone_otp_enabled: merged.phoneOtpEnabled,
      signup_enabled: merged.signupEnabled,
      auto_signup_on_login: merged.autoSignupOnLogin,
      phone_number_required: merged.phoneNumberRequired,
      easy_checkout_enabled: merged.easyCheckoutEnabled,
      name_confirmation_enabled: merged.nameConfirmationEnabled,
      google_client_id: merged.googleClientId,
    });

    const response = this.mapRowToResponse(row);
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    return response;
  }

  async saveGoogleClientId(
    tenantId: string,
    data: SaveGoogleClientIdRequest
  ): Promise<AuthConfigResponse> {
    if (!data.googleClientId || !data.googleClientId.includes(".apps.googleusercontent.com")) {
      throw new BadRequestError("Invalid Google Client ID, must contain .apps.googleusercontent.com");
    }

    const row = await authConfigRepository.updateGoogleClientId(tenantId, data.googleClientId);
    return this.mapRowToResponse(row);
  }

  async clearGoogleClientId(tenantId: string): Promise<AuthConfigResponse> {
    const row = await authConfigRepository.clearGoogleClientId(tenantId);

    if (!row) {
      return {
        id: "",
        tenantId,
        ...DEFAULT_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.mapRowToResponse(row);
  }

  private mapRowToResponse(row: {
    id: string;
    tenant_id: string;
    email_password_enabled: boolean;
    google_oauth_enabled: boolean;
    email_otp_enabled: boolean;
    phone_otp_enabled: boolean;
    signup_enabled: boolean;
    auto_signup_on_login: boolean;
    phone_number_required?: boolean;
    easy_checkout_enabled?: boolean;
    name_confirmation_enabled?: boolean;
    google_client_id?: string | null;
    created_at: Date;
    updated_at: Date;
  }): AuthConfigResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      emailPasswordEnabled: row.email_password_enabled,
      googleOauthEnabled: row.google_oauth_enabled,
      emailOtpEnabled: row.email_otp_enabled,
      phoneOtpEnabled: row.phone_otp_enabled,
      signupEnabled: row.signup_enabled,
      autoSignupOnLogin: row.auto_signup_on_login,
      phoneNumberRequired: row.phone_number_required ?? false,
      easyCheckoutEnabled: row.easy_checkout_enabled ?? false,
      nameConfirmationEnabled: row.name_confirmation_enabled ?? false,
      googleClientId: row.google_client_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new AuthConfigService();

export interface AuthConfigResponse {
  id: string;
  tenantId: string;
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
  createdAt: Date;
  updatedAt: Date;
  warnings?: string[];
}

export interface UpdateAuthConfigRequest {
  emailPasswordEnabled?: boolean;
  googleOauthEnabled?: boolean;
  emailOtpEnabled?: boolean;
  phoneOtpEnabled?: boolean;
  signupEnabled?: boolean;
  autoSignupOnLogin?: boolean;
  phoneNumberRequired?: boolean;
  easyCheckoutEnabled?: boolean;
  nameConfirmationEnabled?: boolean;
}

export interface SaveGoogleClientIdRequest {
  googleClientId: string;
}

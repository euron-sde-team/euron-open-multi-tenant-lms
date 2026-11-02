/** `type` claim on every learner-api token. */
export const LEARNER_TOKEN_TYPE = "learner" as const;

export interface AuthConfigPublic {
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

export interface EasyCheckoutSignupRequest {
  email: string;
  phone: string;
  name?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  googleToken?: string;
  googleAccessToken?: string;
}

export interface OtpSendRequest {
  identifier: string;
  channel: "email" | "whatsapp";
}

export interface OtpVerifyRequest {
  identifier: string;
  channel: "email" | "whatsapp";
  code: string;
  name?: string;
}

export interface AuthResponse {
  accessToken: string;
  member: MemberPublic;
}

export interface MemberPublic {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  nameConfirmedAt: string | null;
  about?: string | null;
  gender?: string | null;
  oauthProvider?: string | null;
  profileMetadata?: Record<string, unknown> | null;
}

export interface GoogleVerificationResult {
  email: string;
  email_verified: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  sub: string;
}

export interface JwtPayload {
  id: string;
  /** Always "learner": staff ("tenant") and operator ("admin") tokens are refused here. */
  type: typeof LEARNER_TOKEN_TYPE;
  tenantId: string;
  email: string;
  sessionToken?: string;
}

/**
 * JWT Token Types
 * Distinguishes between different user types in the platform
 */
export const TokenType = {
  ADMIN: "admin",
  TENANT: "tenant",
  MEMBER: "member",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

/**
 * Base JWT Payload structure
 * All token types extend this
 */
export interface BaseJwtPayload {
  id: string;
  email: string;
  type: TokenType;
  iat?: number; // Issued at (added by JWT library)
  exp?: number; // Expiration (added by JWT library)
}

/**
 * Admin User JWT Payload
 */
export interface AdminJwtPayload extends BaseJwtPayload {
  type: typeof TokenType.ADMIN;
}

/**
 * Tenant User JWT Payload
 */
export interface TenantJwtPayload extends BaseJwtPayload {
  type: typeof TokenType.TENANT;
  tenantId: string; // Tenant context
}

/**
 * Member JWT Payload
 */
export interface MemberJwtPayload extends BaseJwtPayload {
  type: typeof TokenType.MEMBER;
}

/**
 * Union type for all JWT payloads
 */
export type JwtPayload = AdminJwtPayload | TenantJwtPayload | MemberJwtPayload;

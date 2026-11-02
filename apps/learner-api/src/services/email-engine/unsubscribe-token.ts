/**
 * Unsubscribe token: JWT signed with EMAIL_UNSUBSCRIBE_SIGNING_SECRET.
 *
 * The token is embedded in the List-Unsubscribe header (RFC 8058 one-click)
 * and in the tenant's storefront unsubscribe page URL (Phase 11). 90d expiry;
 * expired tokens still work on the storefront page (we render a friendly
 * "this link is old, please click to confirm" UI) but the JWT verifier
 * enforces expiry for one-click POSTs to prevent replay.
 *
 * MUST be signed with the same secret in admin-api AND learner-api
 * so the learner-api's unsubscribe POST can verify a token issued during a
 * admin-api campaign send.
 */

import jwt from "jsonwebtoken";
import config from "../../config";

export interface UnsubscribeTokenPayload {
  tenantId: string;
  email: string;
  messageId: string;
  category: "NOTIFICATION" | "MARKETING";
}

function getSecret(): string {
  const secret = config.EMAIL_UNSUBSCRIBE_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "EMAIL_UNSUBSCRIBE_SIGNING_SECRET is not configured. Set it in .env to a strong random value (openssl rand -base64 48). Must match across admin-api and learner-api.",
    );
  }
  return secret;
}

export function signUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "90d" });
}

export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload {
  const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload &
    Partial<UnsubscribeTokenPayload>;
  if (
    typeof decoded.tenantId !== "string" ||
    typeof decoded.email !== "string" ||
    typeof decoded.messageId !== "string" ||
    (decoded.category !== "NOTIFICATION" && decoded.category !== "MARKETING")
  ) {
    throw new Error("Unsubscribe token payload is malformed");
  }
  return {
    tenantId: decoded.tenantId,
    email: decoded.email,
    messageId: decoded.messageId,
    category: decoded.category,
  };
}

import config from "../config";
import { openSecret, sealSecret } from "./crypto";

/**
 * Tenant payment gateway credentials are stored as one sealed JSON blob
 * (AES-256-GCM, `enc:v1:` prefix, key CREDENTIALS_ENCRYPTION_KEY). learner-api
 * reads them with the same key and format. Never log inputs or outputs.
 */
export function encryptCredentials(plain: Record<string, unknown>): string {
  if (!config.CREDENTIALS_ENCRYPTION_KEY) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  }
  return sealSecret(JSON.stringify(plain));
}

/** Decrypt a value produced by encryptCredentials. Never log the result. */
export function decryptCredentials(stored: string): Record<string, unknown> {
  return JSON.parse(openSecret(stored)) as Record<string, unknown>;
}

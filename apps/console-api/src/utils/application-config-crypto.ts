import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import config from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return scryptSync(trimmed, config.APP_CONFIG_SALT, KEY_LENGTH);
}

function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9+/=]+$/.test(part));
}

export function encryptApplicationSecret(value: string): string {
  const keyRaw = config.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  }

  const key = getKey(keyRaw);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptApplicationSecret(value: string): string {
  const keyRaw = config.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  }

  const parts = value.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value");
  }

  const key = getKey(keyRaw);
  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

export function safeDecryptApplicationSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;

  try {
    return decryptApplicationSecret(value);
  } catch {
    return null;
  }
}

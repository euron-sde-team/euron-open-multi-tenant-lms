/**
 * Canonical phone normalization for tenant_members identity.
 *
 * Strips every non-digit character. The canonical form is digits-only so the
 * same real number entered as "+91 99999 88888", "+919999988888", or
 * "9999988888" all collapse to a single string and a single account.
 *
 * Repository lookups use `regexp_replace(phone, '\D', '', 'g')` to match this
 * shape against legacy rows that may still contain spaces or punctuation.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/**
 * Validate that the normalized phone has at least 8 digits, the floor we use
 * for any plausible international number.
 */
export function isValidNormalizedPhone(value: string): boolean {
  return value.length >= 8 && value.length <= 15;
}

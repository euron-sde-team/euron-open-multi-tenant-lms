/**
 * Generate a unique ID for sections and other entities
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug with a random suffix
 */
export function generateUniqueSlug(text: string): string {
  const baseSlug = generateSlug(text);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${suffix}`;
}

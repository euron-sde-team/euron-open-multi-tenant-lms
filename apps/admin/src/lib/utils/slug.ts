/**
 * Slug Generation Utilities
 * 
 * Provides functions for generating URL-safe slugs from titles,
 * with special character handling and uniqueness support.
 */

/**
 * Generate a URL-safe slug from a title string.
 * 
 * @param title - The title to convert to a slug
 * @returns A URL-safe slug string
 * 
 * @example
 * generateSlug("Hello World!") // "hello-world"
 * generateSlug("Café & Restaurant") // "cafe-restaurant"
 * generateSlug("Python 3.0 - Advanced") // "python-30-advanced"
 */
export function generateSlug(title: string): string {
  if (!title || typeof title !== "string") {
    return "";
  }

  return title
    .toLowerCase()
    .normalize("NFD") // Decompose unicode characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks (accents)
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple consecutive hyphens
    .replace(/^-+|-+$/g, "") // Trim leading and trailing hyphens
    .slice(0, 100) // Limit length to 100 characters
    .replace(/-+$/g, ""); // The cut can land on a hyphen
}

/**
 * Generate a course-specific slug with the "courses/" prefix.
 * 
 * @param title - The course title
 * @returns A slug prefixed with "courses/"
 * 
 * @example
 * generateCourseSlug("Python Masterclass") // "courses/python-masterclass"
 */
export function generateCourseSlug(title: string): string {
  const baseSlug = generateSlug(title);
  return baseSlug ? `courses/${baseSlug}` : "";
}

/**
 * Extract the display slug from a full course slug.
 * Removes the "courses/" prefix if present.
 * 
 * @param fullSlug - The full slug including prefix
 * @returns The slug without the "courses/" prefix
 * 
 * @example
 * extractCourseSlug("courses/python-masterclass") // "python-masterclass"
 * extractCourseSlug("python-masterclass") // "python-masterclass"
 */
export function extractCourseSlug(fullSlug: string): string {
  if (!fullSlug) return "";
  return fullSlug.replace(/^courses\//, "");
}

/**
 * Check if a slug is a course slug (starts with "courses/").
 * 
 * @param slug - The slug to check
 * @returns True if it's a course slug
 */
export function isCourseSlug(slug: string): boolean {
  return slug?.startsWith("courses/") ?? false;
}

/**
 * Generate a unique slug by appending a number suffix if needed.
 * 
 * @param baseSlug - The base slug to make unique
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug
 * 
 * @example
 * makeSlugUnique("courses/python", ["courses/python"]) // "courses/python-2"
 * makeSlugUnique("courses/python", ["courses/python", "courses/python-2"]) // "courses/python-3"
 */
export function makeSlugUnique(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }
  
  return uniqueSlug;
}

/**
 * Validate if a slug is properly formatted.
 * 
 * @param slug - The slug to validate
 * @returns True if the slug is valid
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }
  
  // Allow alphanumeric, hyphens, and forward slashes (for prefixes like courses/)
  const slugPattern = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
  return slugPattern.test(slug);
}

import { customAlphabet } from "nanoid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";

/** A short code that makes a taken slug unique, e.g. "x3k9". */
export const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

/**
 * A URL slug: lowercase letters, digits and single hyphens, accents dropped,
 * at most 100 characters. The same rule as the admin's `generateSlug`, so a
 * slug the admin already sees is stored unchanged.
 */
export function toSlug(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

/** `toSlug`, refusing input with nothing usable in it. */
export function requireSlug(input: string): string {
  const slug = toSlug(input);
  if (!slug) {
    throw new BadRequestError("A URL needs at least one letter or number");
  }
  return slug;
}

/**
 * The slug itself when it is free, else the slug with a short code appended.
 * `isTaken` answers for other items of the same kind in the same tenant (the
 * item being renamed must not count against itself).
 */
export async function uniqueSlug(
  slug: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  if (!(await isTaken(slug))) return slug;
  const base = slug.slice(0, 95).replace(/-+$/g, "");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${slugSuffix()}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new ConflictError("That URL is taken; please try a different one");
}

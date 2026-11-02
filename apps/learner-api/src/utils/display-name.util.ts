/**
 * Resolves a user-friendly display name for a tenant member.
 * Used to populate `fullName` on BBB join URLs so participants see real
 * names in the meeting roster.
 *
 * Order of preference:
 *   1. trimmed `name` if present
 *   2. email local-part (before the @), title-cased
 *   3. "User"
 *
 * Never returns "Guest" or empty string.
 */
export function buildDisplayName(input: {
  name?: string | null;
  email?: string | null;
}): string {
  const trimmedName = input.name?.trim();
  if (trimmedName) return trimmedName;

  const email = input.email?.trim();
  if (email && email.includes("@")) {
    const local = email.split("@")[0] ?? "";
    if (local) {
      return local
        .replace(/[._-]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  return "User";
}

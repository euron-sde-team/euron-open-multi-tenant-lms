/**
 * Safely extracts a human-readable error message from an unknown error value.
 * Both Axios interceptors (admin + web) normalize API errors into standard
 * Error instances, so this utility provides a consistent unknown → string
 * extraction for use in toast descriptions and error UI.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An error occurred";
}

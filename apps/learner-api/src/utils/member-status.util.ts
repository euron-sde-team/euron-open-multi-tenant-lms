import { UnauthorizedError } from "../errors/unauthorized.error";

/**
 * Machine-readable codes the web/mobile clients branch on to show the learner a
 * "your account was suspended" toast instead of a generic auth failure.
 */
export const ACCOUNT_SUSPENDED_CODE = "ACCOUNT_SUSPENDED";
export const ACCOUNT_DEACTIVATED_CODE = "ACCOUNT_DEACTIVATED";

/**
 * Reject a member whose account is no longer ACTIVE.
 *
 * Single source of truth for this check: it runs both at login (auth.service)
 * and on every authenticated request (session.service), and the two must never
 * disagree about the wording or the code the client keys off.
 *
 * Throws UnauthorizedError WITH a code, which is what makes the real message
 * survive serialization, a code-less UnauthorizedError is deliberately
 * flattened to "Not authorized" (see errors/unauthorized.error.ts).
 */
export function assertMemberActive(status: string | null | undefined): void {
  if (status === "ACTIVE") return;

  if (status === "SUSPENDED") {
    throw new UnauthorizedError(
      "Your account has been suspended. Please contact support for assistance.",
      ACCOUNT_SUSPENDED_CODE,
    );
  }

  if (status === "DEACTIVATED") {
    throw new UnauthorizedError(
      "Your account has been deactivated. Please contact support for assistance.",
      ACCOUNT_DEACTIVATED_CODE,
    );
  }

  // Unknown/missing status, deny, but stay generic rather than inventing copy
  // for a state the product does not define.
  throw new UnauthorizedError("Your account is not active");
}

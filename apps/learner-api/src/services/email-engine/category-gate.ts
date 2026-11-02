/**
 * Category gate, the heart of the reputation safety net.
 *
 * Maps (tenant_sending_status, category) -> { allowed, rateMultiplier }.
 *
 * - TRANSACTIONAL is always allowed at full speed. OTPs, password resets,
 *   payment receipts MUST keep flowing even when a tenant's marketing
 *   reputation is destroyed.
 * - NOTIFICATION degrades but never blocks. Course updates, mentions, etc.
 *   slow down (multiplier 0.5) when a tenant is THROTTLED or PAUSED.
 * - MARKETING is the one that gets throttled hardest (0.1 in THROTTLED) and
 *   blocked outright in PAUSED. Campaigns are the typical source of bounce
 *   storms; stopping them is the primary protection for the shared SES
 *   reputation.
 *
 * See spec §7 for the matrix.
 */

export type EmailCategory = "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING";
export type TenantSendingStatus =
  | "ACTIVE"
  | "WARNING"
  | "THROTTLED"
  | "PAUSED";

type Cell = number | "BLOCKED";

const MATRIX: Record<TenantSendingStatus, Record<EmailCategory, Cell>> = {
  ACTIVE: { TRANSACTIONAL: 1.0, NOTIFICATION: 1.0, MARKETING: 1.0 },
  WARNING: { TRANSACTIONAL: 1.0, NOTIFICATION: 1.0, MARKETING: 0.5 },
  THROTTLED: { TRANSACTIONAL: 1.0, NOTIFICATION: 0.5, MARKETING: 0.1 },
  PAUSED: { TRANSACTIONAL: 1.0, NOTIFICATION: 0.5, MARKETING: "BLOCKED" },
};

export interface GateResult {
  /** false ONLY when the category is BLOCKED for the current status. */
  allowed: boolean;
  /** Multiplier applied to the per-tenant TPS bucket at rate-limit time. */
  rateMultiplier: number;
}

export function checkGate(
  status: TenantSendingStatus,
  category: EmailCategory,
): GateResult {
  const cell = MATRIX[status][category];
  if (cell === "BLOCKED") return { allowed: false, rateMultiplier: 0 };
  return { allowed: true, rateMultiplier: cell };
}

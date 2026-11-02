import { describe, it, expect } from "vitest";

import {
  checkGate,
  type EmailCategory,
  type TenantSendingStatus,
} from "../../src/services/email-engine/category-gate";

/**
 * Tests every cell of the 4x3 status × category matrix from spec §7.
 *
 *   Status    | TRANSACTIONAL | NOTIFICATION | MARKETING
 *   ----------|---------------|--------------|----------
 *   ACTIVE    |    1.0        |    1.0       |   1.0
 *   WARNING   |    1.0        |    1.0       |   0.5
 *   THROTTLED |    1.0        |    0.5       |   0.1
 *   PAUSED    |    1.0        |    0.5       |  BLOCKED
 *
 * Invariants verified:
 *   - TRANSACTIONAL is allowed in EVERY status (must never gate OTPs)
 *   - MARKETING is the only thing that goes to BLOCKED, and ONLY in PAUSED
 *   - NOTIFICATION is never blocked
 */
describe("category-gate", () => {
  const STATUSES: TenantSendingStatus[] = [
    "ACTIVE",
    "WARNING",
    "THROTTLED",
    "PAUSED",
  ];
  const CATEGORIES: EmailCategory[] = [
    "TRANSACTIONAL",
    "NOTIFICATION",
    "MARKETING",
  ];

  it("TRANSACTIONAL is allowed at full speed in every status", () => {
    for (const status of STATUSES) {
      const result = checkGate(status, "TRANSACTIONAL");
      expect(result.allowed, `${status}/TRANSACTIONAL must be allowed`).toBe(true);
      expect(
        result.rateMultiplier,
        `${status}/TRANSACTIONAL multiplier must be 1.0`,
      ).toBe(1.0);
    }
  });

  it("NOTIFICATION is allowed in every status", () => {
    for (const status of STATUSES) {
      const result = checkGate(status, "NOTIFICATION");
      expect(result.allowed, `${status}/NOTIFICATION must be allowed`).toBe(
        true,
      );
    }
  });

  it("MARKETING is BLOCKED only in PAUSED", () => {
    expect(checkGate("ACTIVE", "MARKETING").allowed).toBe(true);
    expect(checkGate("WARNING", "MARKETING").allowed).toBe(true);
    expect(checkGate("THROTTLED", "MARKETING").allowed).toBe(true);

    const paused = checkGate("PAUSED", "MARKETING");
    expect(paused.allowed).toBe(false);
    expect(paused.rateMultiplier).toBe(0);
  });

  it("NOTIFICATION multiplier matches spec §7 matrix", () => {
    expect(checkGate("ACTIVE", "NOTIFICATION").rateMultiplier).toBe(1.0);
    expect(checkGate("WARNING", "NOTIFICATION").rateMultiplier).toBe(1.0);
    expect(checkGate("THROTTLED", "NOTIFICATION").rateMultiplier).toBe(0.5);
    expect(checkGate("PAUSED", "NOTIFICATION").rateMultiplier).toBe(0.5);
  });

  it("MARKETING multiplier matches spec §7 matrix", () => {
    expect(checkGate("ACTIVE", "MARKETING").rateMultiplier).toBe(1.0);
    expect(checkGate("WARNING", "MARKETING").rateMultiplier).toBe(0.5);
    expect(checkGate("THROTTLED", "MARKETING").rateMultiplier).toBe(0.1);
    expect(checkGate("PAUSED", "MARKETING").rateMultiplier).toBe(0);
  });

  it("every cell returns a defined result (no silent undefined)", () => {
    for (const status of STATUSES) {
      for (const category of CATEGORIES) {
        const result = checkGate(status, category);
        expect(result).toBeDefined();
        expect(typeof result.allowed).toBe("boolean");
        expect(typeof result.rateMultiplier).toBe("number");
        expect(result.rateMultiplier).toBeGreaterThanOrEqual(0);
        expect(result.rateMultiplier).toBeLessThanOrEqual(1);
      }
    }
  });
});

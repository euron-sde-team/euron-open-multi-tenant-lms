import { describe, it, expect, beforeAll } from "vitest";

/**
 * Unsubscribe JWT sign/verify/tamper tests.
 *
 * The signing secret is loaded from EMAIL_UNSUBSCRIBE_SIGNING_SECRET via
 * the config module. We set it BEFORE importing the module under test so
 * the config picks it up at first import. Vitest runs each test file in
 * isolation, so this env mutation doesn't leak across files.
 */
beforeAll(() => {
  process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET =
    "test-secret-do-not-use-in-prod-aaaaaaaaaaaaaaaaaaaa";
});

describe("unsubscribe-token", () => {
  it("signs a NOTIFICATION token and verifies it back to the same payload", async () => {
    const {
      signUnsubscribeToken,
      verifyUnsubscribeToken,
    } = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    const payload = {
      tenantId: "01TENANT00000000000000000",
      email: "user@example.com",
      messageId: "01MESSAGE0000000000000000",
      category: "NOTIFICATION" as const,
    };
    const token = signUnsubscribeToken(payload);
    expect(token).toBeTypeOf("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature

    const verified = verifyUnsubscribeToken(token);
    expect(verified.tenantId).toBe(payload.tenantId);
    expect(verified.email).toBe(payload.email);
    expect(verified.messageId).toBe(payload.messageId);
    expect(verified.category).toBe("NOTIFICATION");
  });

  it("signs a MARKETING token and verifies it back", async () => {
    const {
      signUnsubscribeToken,
      verifyUnsubscribeToken,
    } = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    const payload = {
      tenantId: "01TENANT11111111111111111",
      email: "marketing-recipient@example.com",
      messageId: "01MSGGG1111111111111111111",
      category: "MARKETING" as const,
    };
    const token = signUnsubscribeToken(payload);
    const verified = verifyUnsubscribeToken(token);
    expect(verified.category).toBe("MARKETING");
  });

  it("rejects a tampered token (modified signature)", async () => {
    const {
      signUnsubscribeToken,
      verifyUnsubscribeToken,
    } = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    const token = signUnsubscribeToken({
      tenantId: "01TENANT00000000000000000",
      email: "user@example.com",
      messageId: "01MESSAGE0000000000000000",
      category: "NOTIFICATION",
    });
    // Flip the last character of the signature segment.
    const parts = token.split(".");
    const lastChar = parts[2].slice(-1);
    const replacement = lastChar === "A" ? "B" : "A";
    parts[2] = parts[2].slice(0, -1) + replacement;
    const tampered = parts.join(".");

    expect(() => verifyUnsubscribeToken(tampered)).toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    // Sign with the configured secret.
    const mod = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    const goodToken = mod.signUnsubscribeToken({
      tenantId: "01TENANT00000000000000000",
      email: "user@example.com",
      messageId: "01MESSAGE0000000000000000",
      category: "NOTIFICATION",
    });
    // Sign a parallel token with a different secret using jsonwebtoken
    // directly, then verify against the engine module, must reject.
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign(
      {
        tenantId: "01ATTACKER0000000000000000",
        email: "attacker@example.com",
        messageId: "01FORGED00000000000000000",
        category: "MARKETING",
      },
      "different-secret-not-shared-with-prod",
      { expiresIn: "90d" },
    );
    expect(() => mod.verifyUnsubscribeToken(forged)).toThrow();
    // Original token still works.
    expect(() => mod.verifyUnsubscribeToken(goodToken)).not.toThrow();
  });

  it("rejects a malformed payload (missing required fields)", async () => {
    const mod = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    // Hand-sign a payload missing the `category` field.
    const jwt = (await import("jsonwebtoken")).default;
    const incomplete = jwt.sign(
      {
        tenantId: "01TENANT00000000000000000",
        email: "user@example.com",
        // missingId, no category
      },
      "test-secret-do-not-use-in-prod-aaaaaaaaaaaaaaaaaaaa",
      { expiresIn: "90d" },
    );
    expect(() => mod.verifyUnsubscribeToken(incomplete)).toThrow(
      /malformed/i,
    );
  });

  it("rejects a payload with an invalid category value", async () => {
    const mod = await import(
      "../../src/services/email-engine/unsubscribe-token"
    );
    const jwt = (await import("jsonwebtoken")).default;
    const wrongCategory = jwt.sign(
      {
        tenantId: "01TENANT00000000000000000",
        email: "user@example.com",
        messageId: "01MESSAGE0000000000000000",
        category: "TRANSACTIONAL", // TRANSACTIONAL never gets List-Unsubscribe
      },
      "test-secret-do-not-use-in-prod-aaaaaaaaaaaaaaaaaaaa",
      { expiresIn: "90d" },
    );
    expect(() => mod.verifyUnsubscribeToken(wrongCategory)).toThrow();
  });
});

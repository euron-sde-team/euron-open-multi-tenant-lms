/**
 * Email unsubscribe service (learner-api).
 *
 * Lives in learner-api because the unsubscribe flow is end-user-facing: the
 * recipient receives an email, clicks the storefront link, lands on the
 * confirmation page, and submits. learner-api already mirrors the email
 * engine (suppression + JWT token verifier), so the verify/confirm endpoints
 * stay close to the audience they serve.
 *
 * The unsubscribe JWT (signed with EMAIL_UNSUBSCRIBE_SIGNING_SECRET shared
 * with admin-api) is the entire auth boundary. Anyone with the
 * token can verify + confirm, which is correct because the token was mailed
 * to the recipient.
 *
 * Three scope choices:
 *   - "category"  -> suppress for the category the email was sent on
 *   - "marketing" -> suppress MARKETING specifically (regardless of token's category)
 *   - "all"       -> suppress BOTH NOTIFICATION + MARKETING; TRANSACTIONAL
 *                    keeps flowing (OTPs, password resets, payment receipts).
 *
 * One-click RFC 8058 POSTs default to "category". Most conservative: stop
 * the kind of email the user just received, leave the rest alone.
 *
 * IMPORTANT: scope "all" inserts TWO suppression rows (NOTIFICATION +
 * MARKETING) rather than one row with category_scope=NULL. A NULL scope
 * row would also suppress TRANSACTIONAL, correct semantics for HARD_BOUNCE
 * / COMPLAINT (we don't want to OTP a dead mailbox), but wrong for a
 * user-initiated "stop everything non-essential", the user still needs
 * OTPs to log in.
 */

import { BadRequestError } from "../errors/bad-request.error";
import { db } from "../db/connection";
import { addSuppression, isSuppressed } from "./email-engine/suppression";
import {
  verifyUnsubscribeToken as verifyJwt,
  type UnsubscribeTokenPayload,
} from "./email-engine/unsubscribe-token";

export type UnsubscribeScope = "category" | "marketing" | "all";

export interface VerifiedToken {
  tenantId: string;
  tenantName: string | null;
  email: string;
  messageId: string;
  category: "NOTIFICATION" | "MARKETING";
  alreadyUnsubscribedAtAll: boolean;
  alreadyUnsubscribedFromCategory: boolean;
}

export interface ConfirmResult {
  email: string;
  scope: UnsubscribeScope;
  appliedCategories: ("NOTIFICATION" | "MARKETING")[];
}

class EmailUnsubscribeService {
  private async parseToken(token: string): Promise<UnsubscribeTokenPayload> {
    try {
      return verifyJwt(token);
    } catch (err) {
      throw new BadRequestError(
        `Unsubscribe link is invalid or expired: ${(err as Error).message}`,
      );
    }
  }

  async verify(token: string): Promise<VerifiedToken> {
    const payload = await this.parseToken(token);

    const tenant = await db
      .selectFrom("tenants")
      .select(["name"])
      .where("id", "=", payload.tenantId)
      .executeTakeFirst();

    const [alreadyForCategory, alreadyForMarketing] = await Promise.all([
      isSuppressed(payload.tenantId, payload.email, payload.category),
      isSuppressed(payload.tenantId, payload.email, "MARKETING"),
    ]);

    return {
      tenantId: payload.tenantId,
      tenantName: tenant?.name ?? null,
      email: payload.email,
      messageId: payload.messageId,
      category: payload.category,
      alreadyUnsubscribedFromCategory: alreadyForCategory,
      alreadyUnsubscribedAtAll: alreadyForCategory && alreadyForMarketing,
    };
  }

  async confirm(token: string, scope: UnsubscribeScope): Promise<ConfirmResult> {
    if (scope !== "category" && scope !== "marketing" && scope !== "all") {
      throw new BadRequestError(
        `Invalid scope "${scope}". Must be one of: category, marketing, all.`,
      );
    }
    const payload = await this.parseToken(token);

    const applied: ("NOTIFICATION" | "MARKETING")[] = [];
    switch (scope) {
      case "category":
        applied.push(payload.category);
        await addSuppression({
          tenantId: payload.tenantId,
          email: payload.email,
          reason: "MANUAL_UNSUBSCRIBE",
          sourceMessageId: payload.messageId,
          categoryScope: payload.category,
        });
        break;
      case "marketing":
        applied.push("MARKETING");
        await addSuppression({
          tenantId: payload.tenantId,
          email: payload.email,
          reason: "MANUAL_UNSUBSCRIBE",
          sourceMessageId: payload.messageId,
          categoryScope: "MARKETING",
        });
        break;
      case "all":
        // Two rows so TRANSACTIONAL keeps flowing. See class docstring.
        applied.push("NOTIFICATION", "MARKETING");
        await addSuppression({
          tenantId: payload.tenantId,
          email: payload.email,
          reason: "MANUAL_UNSUBSCRIBE",
          sourceMessageId: payload.messageId,
          categoryScope: "NOTIFICATION",
        });
        await addSuppression({
          tenantId: payload.tenantId,
          email: payload.email,
          reason: "MANUAL_UNSUBSCRIBE",
          sourceMessageId: payload.messageId,
          categoryScope: "MARKETING",
        });
        break;
    }

    return {
      email: payload.email,
      scope,
      appliedCategories: applied,
    };
  }
}

export default new EmailUnsubscribeService();

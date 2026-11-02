import { db } from "../db/connection";
import {
  EnrollmentConfirmationJob,
  GrantItemType,
  queueEnrollmentConfirmation,
  queueEnrollmentConfirmationsBulk,
} from "../queues/user-notification.queue";
import logger from "../utils/logger";

/**
 * Emails a learner when an admin grants them content access.
 *
 * The actual send happens in learner-api: we enqueue an
 * "enrollment-confirmation" job onto the shared "user-notification" queue and
 * its worker renders + sends the email FROM THE TENANT (same engine as OTP),
 * only when the member has a real email address. Everything here is
 * best-effort: a notification failure must never block or fail the grant.
 */

const TABLE_BY_TYPE: Record<
  GrantItemType,
  "courses" | "books" | "bundles" | "test_series" | "batches"
> = {
  COURSE: "courses",
  BOOK: "books",
  BUNDLE: "bundles",
  TEST_SERIES: "test_series",
  BATCH: "batches",
};

async function resolveItemName(
  tenantId: string,
  itemType: GrantItemType,
  itemId: string,
): Promise<string> {
  try {
    const table = TABLE_BY_TYPE[itemType];
    const row = await db
      .selectFrom(table)
      .select("title")
      .where("id", "=", itemId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return row?.title || "your content";
  } catch (error) {
    logger.error(
      `resolveItemName failed for ${itemType} ${itemId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "your content";
  }
}

class GrantNotificationService {
  /**
   * Notify a single learner about a new grant. Fire-and-forget from callers.
   */
  async notifyGrant(
    tenantId: string,
    memberId: string,
    itemType: GrantItemType,
    itemId: string,
  ): Promise<void> {
    try {
      const itemName = await resolveItemName(tenantId, itemType, itemId);
      await queueEnrollmentConfirmation({
        type: "enrollment-confirmation",
        tenantId,
        memberId,
        metadata: { itemName, itemType, itemId },
      });
    } catch (error) {
      logger.error(
        `notifyGrant failed (tenant ${tenantId}, member ${memberId}, ${itemType} ${itemId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Notify many learners about the same grant (bulk). Resolves the item name
   * once and enqueues one job per member.
   */
  async notifyBulkGrant(
    tenantId: string,
    itemType: GrantItemType,
    itemId: string,
    memberIds: string[],
  ): Promise<void> {
    if (memberIds.length === 0) return;
    try {
      const itemName = await resolveItemName(tenantId, itemType, itemId);
      const jobs: EnrollmentConfirmationJob[] = memberIds.map((memberId) => ({
        type: "enrollment-confirmation",
        tenantId,
        memberId,
        metadata: { itemName, itemType, itemId },
      }));
      await queueEnrollmentConfirmationsBulk(jobs);
    } catch (error) {
      logger.error(
        `notifyBulkGrant failed (tenant ${tenantId}, ${itemType} ${itemId}, ${memberIds.length} members): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export default new GrantNotificationService();

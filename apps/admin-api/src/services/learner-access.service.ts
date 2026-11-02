/**
 * One learner, everything about them, and one way to change what they can reach.
 *
 * WHY THIS EXISTS AS A SERVICE RATHER THAN AS SEVEN MORE TOOLS
 * -----------------------------------------------------------
 * The platform already has every primitive: a route to grant a course, another
 * for a book, another for a batch, more for test series and bundles, plus a
 * revoke and a validity patch for most of them. Many endpoints, each correct,
 * each doing a fragment of one job.
 *
 * That shape is right for a dashboard, where a person is already looking at the
 * "books" tab and knows which fragment they want. It is wrong for an assistant.
 * "Give Priya three more months on the DevOps course" is ONE thing an admin
 * says, and answering it out of the primitives means the model has to pick the
 * right one of four validity endpoints, find the access row's id first, and
 * hold the difference between an `accessId`, an `enrollmentId`, a
 * `registrationId` and a `purchaseId`. Every one of those is a chance to pick
 * wrong, and wrong here means somebody loses what they paid for.
 *
 * So the fragments stay where they are and this composes them:
 *
 *   overview()      one read: who they are, everything they can reach, when
 *                   each ends, what they paid. Replaces nine calls.
 *   changeAccess()  one write: grant, extend or revoke, for any kind of
 *                   content, addressed by the CONTENT the admin named rather
 *                   than by a row id they would have had to look up first.
 *
 * Nothing here reimplements a business rule. Grants still go through
 * `membersService` and `bulkEnrollService`, which is what keeps the batch
 * fan-out and the grant notification in place. This layer answers "which row is that" and "what is it called", which
 * is exactly the part a model should not be guessing at.
 */
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import bulkEnrollService from "./bulk-enroll.service";
import membersService from "./members.service";

export const LEARNER_CONTENT_TYPES = [
  "COURSE",
  "BOOK",
  "BATCH",
  "TEST_SERIES",
  "BUNDLE",
] as const;

export type LearnerContentType = (typeof LEARNER_CONTENT_TYPES)[number];

export const ACCESS_ACTIONS = ["GRANT", "EXTEND", "REVOKE"] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export interface ChangeAccessInput {
  tenantId: string;
  memberId: string;
  action: AccessAction;
  contentType: LearnerContentType;
  contentId: string;
  /** Absolute end date. Null means it never ends. Undefined means leave it alone. */
  validTill?: Date | null;
}

/** One thing a learner can reach, in the words an admin uses for it. */
export interface AccessRow {
  /** Row id. Later steps need it; nothing a person reads contains it. */
  id: string;
  contentType: LearnerContentType;
  contentId: string;
  title: string;
  status: string;
  source: string | null;
  validTill: string | null;
  startedAt: string | null;
  progressPercent?: number;
}

export interface ChangeAccessResult {
  action: AccessAction;
  outcome: string;
  memberName: string;
  contentType: LearnerContentType;
  contentId: string;
  contentTitle: string;
  accessId: string | null;
  validTill: string | null;
  note?: string;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Which kinds of access carry an end date at all.
 *
 * A bundle grant does not: its access lives on the child courses and books.
 * Asking to extend one is not a failure to retry, it is a thing the platform
 * does not have, and the caller is told so in those words.
 */
const EXPIRES: Record<LearnerContentType, boolean> = {
  COURSE: true,
  BOOK: true,
  BATCH: true,
  TEST_SERIES: true,
  BUNDLE: false,
};

/** Kinds of access that can be taken back one row at a time. */
const REVOCABLE: Record<LearnerContentType, boolean> = {
  COURSE: true,
  BOOK: true,
  BATCH: true,
  TEST_SERIES: true,
  BUNDLE: false,
};

const LABEL: Record<LearnerContentType, string> = {
  COURSE: "course",
  BOOK: "book",
  BATCH: "batch",
  TEST_SERIES: "test series",
  BUNDLE: "bundle",
};

class LearnerAccessService {
  /* ================================================================ */
  /*  Read                                                            */
  /* ================================================================ */

  /**
   * Everything about one learner in a single answer: who they are, every kind
   * of content they can reach with its title and expiry, what they have paid,
   * and their certificates.
   *
   * Row ids are in the payload because a follow-up step needs them; the titles
   * are there so nothing a person reads is an id.
   */
  async overview(
    tenantId: string,
    memberId: string,
    opts: { orderLimit?: number } = {}
  ): Promise<{
    member: unknown;
    access: AccessRow[];
    accessCounts: Record<string, number>;
    orders: unknown[];
    certificates: unknown[];
    totals: unknown;
    note: string;
  }> {
    const orderLimit = Math.min(Math.max(opts.orderLimit ?? 10, 1), 50);

    const [
      member,
      enrollments,
      bookAccess,
      batches,
      testSeries,
      orders,
      certificates,
      totals,
    ] = await Promise.all([
      membersService.getMember(tenantId, memberId),
      membersService.getMemberEnrollments(tenantId, memberId),
      membersService.getMemberBookAccess(tenantId, memberId),
      membersService.getMemberBatchEnrollments(tenantId, memberId),
      membersService.getMemberTestSeriesEnrollments(tenantId, memberId),
      membersService.getMemberOrders(tenantId, memberId),
      membersService.getMemberCertificates(tenantId, memberId),
      membersService.getMemberDetailStats(tenantId, memberId),
    ]);

    const access: AccessRow[] = [
      ...enrollments.map((r) => ({
        id: r.id,
        contentType: "COURSE" as const,
        contentId: r.course_id,
        title: r.course_title,
        status: String(r.status),
        source: r.source ? String(r.source) : null,
        validTill: iso(r.valid_till),
        startedAt: iso(r.enrolled_at),
        progressPercent: toNumber((r as { progress_percent?: unknown }).progress_percent),
      })),
      ...bookAccess.map((r) => ({
        id: r.id,
        contentType: "BOOK" as const,
        contentId: r.book_id,
        title: r.book_title,
        status: String(r.status),
        source: r.source ? String(r.source) : null,
        validTill: iso(r.valid_till),
        startedAt: iso(r.created_at),
      })),
      ...batches.map((r) => ({
        id: r.id,
        contentType: "BATCH" as const,
        contentId: r.batch_id,
        title: r.batch_title,
        status: String(r.status),
        source: r.source ? String(r.source) : null,
        validTill: iso(r.valid_till),
        startedAt: iso(r.joined_at),
      })),
      ...testSeries.map((r) => ({
        id: r.id,
        contentType: "TEST_SERIES" as const,
        contentId: r.test_series_id,
        title: r.test_series_title,
        status: String(r.status),
        source: r.source ? String(r.source) : null,
        validTill: iso(r.valid_till),
        startedAt: iso(r.enrolled_at),
      })),
    ];

    const accessCounts: Record<string, number> = {};
    for (const row of access) {
      accessCounts[row.contentType] = (accessCounts[row.contentType] ?? 0) + 1;
    }

    return {
      member,
      access,
      accessCounts,
      orders: orders.slice(0, orderLimit),
      certificates,
      totals,
      note:
        access.length === 0
          ? "This learner cannot reach anything yet."
          : "A status of CANCELLED means the access was taken away; a validTill in the past means it lapsed on its own.",
    };
  }

  /* ================================================================ */
  /*  Write                                                           */
  /* ================================================================ */

  /**
   * Grant, extend or revoke one learner's access to one thing, addressed by the
   * CONTENT rather than by the access row.
   *
   * Extending and revoking find the row themselves. That is the point: an admin
   * says "the DevOps course", not "enrolment 01J...", and every wrong answer in
   * this area is somebody losing access they paid for.
   */
  async changeAccess(input: ChangeAccessInput): Promise<ChangeAccessResult> {
    const member = await membersService.getMember(input.tenantId, input.memberId);

    switch (input.action) {
      case "GRANT":
        return this.grant(input, member.name);
      case "EXTEND":
        return this.extend(input, member.name);
      case "REVOKE":
        return this.revoke(input, member.name);
      default:
        throw new BadRequestError(
          `action must be GRANT, EXTEND or REVOKE. Received "${String(input.action)}".`
        );
    }
  }

  private async grant(
    input: ChangeAccessInput,
    memberName: string
  ): Promise<ChangeAccessResult> {
    const { tenantId, memberId, contentType, contentId, validTill } = input;

    // Fails loudly and by name before anything is written, rather than letting
    // a mistyped id become "Course not found" three layers down.
    const title = await this.titleOf(tenantId, contentType, contentId);

    let outcome = "ACCESS_GRANTED";
    if (contentType === "COURSE") {
      await membersService.grantCourseAccess(tenantId, memberId, contentId);
    } else if (contentType === "BOOK") {
      await membersService.grantBookAccess(tenantId, memberId, contentId);
    } else {
      outcome = await bulkEnrollService.grantSingle(
        tenantId,
        contentType,
        contentId,
        memberId,
        validTill ?? null
      );
    }

    // The course and book grant routes fix their own one-year expiry and ignore
    // a requested end date. Rather than leave the caller believing the date they
    // asked for was honoured, set it on the row that was just created: the
    // composite doing what a person would have done by hand.
    let row = await this.findAccessRow(tenantId, memberId, contentType, contentId);
    if (
      validTill !== undefined &&
      row &&
      (contentType === "COURSE" || contentType === "BOOK")
    ) {
      await this.setValidity(tenantId, memberId, contentType, row.id, validTill);
      row = await this.findAccessRow(tenantId, memberId, contentType, contentId);
    }

    return {
      action: "GRANT",
      outcome,
      memberName,
      contentType,
      contentId,
      contentTitle: row?.title ?? title,
      accessId: row?.id ?? null,
      validTill: row?.validTill ?? null,
      ...(EXPIRES[contentType]
        ? {}
        : {
            note: `Access to a ${LABEL[contentType]} does not expire, so no end date was set.`,
          }),
    };
  }

  private async extend(
    input: ChangeAccessInput,
    memberName: string
  ): Promise<ChangeAccessResult> {
    const { tenantId, memberId, contentType, contentId, validTill } = input;

    if (!EXPIRES[contentType]) {
      throw new BadRequestError(
        `Access to a ${LABEL[contentType]} has no end date, so there is nothing to extend. ` +
          "Only courses, books, batches and test series expire."
      );
    }
    if (validTill === undefined) {
      throw new BadRequestError(
        "valid_till is required when extending access: send the new end date as an ISO date, or null for access that never ends."
      );
    }

    const row = await this.requireAccessRow(tenantId, memberId, contentType, contentId);
    await this.setValidity(tenantId, memberId, contentType, row.id, validTill);
    const after = await this.findAccessRow(tenantId, memberId, contentType, contentId);

    return {
      action: "EXTEND",
      outcome: "VALIDITY_CHANGED",
      memberName,
      contentType,
      contentId,
      contentTitle: row.title,
      accessId: row.id,
      validTill: after?.validTill ?? null,
    };
  }

  private async revoke(
    input: ChangeAccessInput,
    memberName: string
  ): Promise<ChangeAccessResult> {
    const { tenantId, memberId, contentType, contentId } = input;

    if (!REVOCABLE[contentType]) {
      throw new BadRequestError(
        "A bundle grant cannot be taken back as one thing: it fanned out into the courses and books inside it. " +
          "Revoke those one at a time instead."
      );
    }

    const row = await this.requireAccessRow(tenantId, memberId, contentType, contentId);

    switch (contentType) {
      case "COURSE":
        await membersService.revokeCourseAccess(tenantId, memberId, row.id);
        break;
      case "BOOK":
        await membersService.revokeBookAccess(tenantId, memberId, row.id);
        break;
      case "BATCH":
        await membersService.revokeBatchAccess(tenantId, memberId, row.id);
        break;
      case "TEST_SERIES":
        await membersService.revokeTestSeriesAccess(tenantId, memberId, row.id);
        break;
      default:
        throw new BadRequestError(`Access to a ${LABEL[contentType]} cannot be taken back.`);
    }

    return {
      action: "REVOKE",
      outcome: "ACCESS_REVOKED",
      memberName,
      contentType,
      contentId,
      contentTitle: row.title,
      accessId: row.id,
      validTill: null,
    };
  }

  /* ================================================================ */
  /*  Row resolution                                                  */
  /* ================================================================ */

  private async setValidity(
    tenantId: string,
    memberId: string,
    contentType: LearnerContentType,
    rowId: string,
    validTill: Date | null | undefined
  ): Promise<void> {
    const value = validTill ?? null;
    switch (contentType) {
      case "COURSE":
        return membersService.updateEnrollmentValidity(tenantId, memberId, rowId, value);
      case "BOOK":
        return membersService.updateBookAccessValidity(tenantId, memberId, rowId, value);
      case "BATCH":
        return membersService.updateBatchEnrollmentValidity(tenantId, memberId, rowId, value);
      case "TEST_SERIES":
        return membersService.updateTestSeriesEnrollmentValidity(
          tenantId,
          memberId,
          rowId,
          value
        );
      default:
        throw new BadRequestError(
          `Access to a ${LABEL[contentType]} has no end date to change.`
        );
    }
  }

  /**
   * The learner's access row for one piece of content.
   *
   * Prefers a row that is still live: a learner who was revoked and re-granted
   * has two, and acting on the dead one would silently do nothing.
   */
  private async findAccessRow(
    tenantId: string,
    memberId: string,
    contentType: LearnerContentType,
    contentId: string
  ): Promise<AccessRow | undefined> {
    const { access } = await this.overview(tenantId, memberId, { orderLimit: 1 });
    const matches = access.filter(
      (r) => r.contentType === contentType && r.contentId === contentId
    );
    return matches.find((r) => r.status !== "CANCELLED") ?? matches[0];
  }

  private async requireAccessRow(
    tenantId: string,
    memberId: string,
    contentType: LearnerContentType,
    contentId: string
  ): Promise<AccessRow> {
    const row = await this.findAccessRow(tenantId, memberId, contentType, contentId);
    if (!row) {
      const title = await this.titleOf(tenantId, contentType, contentId);
      throw new NotFoundError(
        `This learner has no access to the ${LABEL[contentType]} "${title}", so there is nothing to change. ` +
          "Read their overview first to see what they can reach."
      );
    }
    return row;
  }

  /** What the content is called, for a message a person reads. */
  private async titleOf(
    tenantId: string,
    contentType: LearnerContentType,
    contentId: string
  ): Promise<string> {
    const found = await this.selectTitle(tenantId, contentType, contentId);
    if (!found) {
      throw new NotFoundError(
        `There is no ${LABEL[contentType]} with that id in this workspace. Search for it by name first.`
      );
    }
    return found;
  }

  private async selectTitle(
    tenantId: string,
    contentType: LearnerContentType,
    contentId: string
  ): Promise<string | undefined> {
    const titleOf = (row?: { title: string }) => row?.title;
    switch (contentType) {
      case "COURSE":
        return titleOf(
          await db
            .selectFrom("courses")
            .select("title")
            .where("tenant_id", "=", tenantId)
            .where("id", "=", contentId)
            .executeTakeFirst()
        );
      case "BOOK":
        return titleOf(
          await db
            .selectFrom("books")
            .select("title")
            .where("tenant_id", "=", tenantId)
            .where("id", "=", contentId)
            .executeTakeFirst()
        );
      case "BATCH":
        return titleOf(
          await db
            .selectFrom("batches")
            .select("title")
            .where("tenant_id", "=", tenantId)
            .where("id", "=", contentId)
            .executeTakeFirst()
        );
      case "TEST_SERIES":
        return titleOf(
          await db
            .selectFrom("test_series")
            .select("title")
            .where("tenant_id", "=", tenantId)
            .where("id", "=", contentId)
            .executeTakeFirst()
        );
      case "BUNDLE":
        return titleOf(
          await db
            .selectFrom("bundles")
            .select("title")
            .where("tenant_id", "=", tenantId)
            .where("id", "=", contentId)
            .executeTakeFirst()
        );
      default:
        return undefined;
    }
  }
}

export default new LearnerAccessService();

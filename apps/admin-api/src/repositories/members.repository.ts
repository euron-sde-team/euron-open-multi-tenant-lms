import type { Transaction } from "kysely";
import { sql } from "kysely";
import { ulid } from "ulid";

import { db } from "../db/connection";
import type { DB } from "../db/types";
import type {
  member_status,
  enrollment_status,
  test_series_enrollment_status,
} from "../db/enums";

export interface MemberContactSnapshot {
  id: string;
  status: member_status;
  email: string | null;
  phone: string | null;
}
import {
  makeRevenueBreakdown,
  type RevenueBreakdown,
} from "../utils/currency.util";

export interface MembersListParams {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface MemberListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: member_status;
  joined_at: Date;
  last_login_at: Date | null;
  enrollment_count: number;
  book_access_count: number;
  certificate_count: number;
  /** Total spent per currency + combined-in-INR. */
  total_spent: RevenueBreakdown;
}

export interface MembersListResult {
  members: MemberListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MemberDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: member_status;
  email_verified: boolean;
  phone_verified: boolean;
  oauth_provider: string | null;
  joined_at: Date;
  last_login_at: Date | null;
  created_at: Date;
}

export interface MemberEnrollment {
  id: string;
  course_id: string;
  course_title: string;
  course_mode: string;
  status: enrollment_status;
  source: string;
  enrolled_at: Date;
  completed_at: Date | null;
  valid_till: Date | null;
  progress_percent: number;
}

export interface MemberBookAccess {
  id: string;
  book_id: string;
  book_title: string;
  status: string;
  source: string;
  valid_till: Date | null;
  created_at: Date;
}

export interface MemberOrder {
  id: string;
  order_number: string;
  order_type: string;
  base_amount: string;
  discount_amount: string;
  total_amount: string;
  currency: string;
  coupon_code_snapshot: string | null;
  gateway_provider_name: string | null;
  status: string;
  paid_at: Date | null;
  created_at: Date;
}

export interface MemberCertificate {
  id: string;
  course_id: string;
  course_title: string;
  certificate_number: string;
  status: string;
  issued_at: Date;
}

export interface MemberStats {
  total_members: number;
  active_members: number;
  suspended_members: number;
  new_members_30d: number;
}

export interface MemberDetailStats {
  enrollment_count: number;
  book_access_count: number;
  certificate_count: number;
  order_count: number;
  /** Total spent per currency + combined-in-INR. */
  total_spent: RevenueBreakdown;
}

export interface MemberCartItem {
  id: string;
  item_type: string;
  item_title: string;
  coupon_code: string | null;
  created_at: Date;
}

export interface MemberCouponRedemption {
  id: string;
  coupon_code: string;
  coupon_discount_type: string;
  coupon_discount_value: string;
  order_number: string;
  discount_amount: string;
  currency: string;
  created_at: Date;
}

export interface MemberRefund {
  id: string;
  order_id: string;
  order_number: string;
  amount: string;
  reason: string | null;
  status: string;
  processed_at: Date | null;
  created_at: Date;
}

class MembersRepository {
  async list(params: MembersListParams): Promise<MembersListResult> {
    const { tenantId, page, limit, search, status, sortBy, sortOrder } = params;
    const offset = (page - 1) * limit;

    let baseQuery = db
      .selectFrom("tenant_members as m")
      .where("m.tenant_id", "=", tenantId);

    if (search) {
      const term = `%${search}%`;
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb("m.name", "ilike", term),
          eb("m.email", "ilike", term),
          eb("m.phone", "ilike", term),
        ])
      );
    }

    if (status) {
      baseQuery = baseQuery.where(
        "m.status",
        "=",
        status as member_status
      );
    }

    const countResult = await baseQuery
      .select(sql<number>`count(*)::int`.as("total"))
      .executeTakeFirstOrThrow();

    const sortColumn = (
      {
        name: "m.name",
        email: "m.email",
        joined_at: "m.joined_at",
        last_login_at: "m.last_login_at",
      } as Record<string, string>
    )[sortBy ?? "joined_at"] ?? "m.joined_at";

    // Revenue split by payment currency via per-member subselects. Previously
    // this used a LEFT JOIN + sum(distinct total_amount) which both mixed
    // currencies and also produced wrong totals if two orders happened to
    // share the same amount value.
    const members = await db
      .selectFrom("tenant_members as m")
      .leftJoin("enrollments as e", (join) =>
        join
          .onRef("e.tenant_member_id", "=", "m.id")
          .on("e.tenant_id", "=", tenantId)
      )
      .leftJoin("book_access as ba", (join) =>
        join
          .onRef("ba.tenant_member_id", "=", "m.id")
          .on("ba.tenant_id", "=", tenantId)
      )
      .leftJoin("certificates as cert", (join) =>
        join
          .onRef("cert.tenant_member_id", "=", "m.id")
          .on("cert.tenant_id", "=", tenantId)
      )
      .select([
        "m.id",
        "m.name",
        "m.email",
        "m.phone",
        "m.avatar_url",
        "m.status",
        "m.joined_at",
        "m.last_login_at",
        sql<number>`count(distinct e.id)::int`.as("enrollment_count"),
        sql<number>`count(distinct ba.id)::int`.as("book_access_count"),
        sql<number>`count(distinct cert.id)::int`.as("certificate_count"),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_id = ${tenantId} and po.tenant_member_id = m.id and po.status = 'PAID' and po.currency = 'INR'), 0)`.as(
          "spent_inr"
        ),
        sql<string>`coalesce((select sum(po.total_amount) from payment_orders po where po.tenant_id = ${tenantId} and po.tenant_member_id = m.id and po.status = 'PAID' and po.currency = 'USD'), 0)`.as(
          "spent_usd"
        ),
      ])
      .where("m.tenant_id", "=", tenantId)
      .$if(!!search, (qb) => {
        const term = `%${search}%`;
        return qb.where((eb) =>
          eb.or([
            eb("m.name", "ilike", term),
            eb("m.email", "ilike", term),
            eb("m.phone", "ilike", term),
          ])
        );
      })
      .$if(!!status, (qb) =>
        qb.where("m.status", "=", status as member_status)
      )
      .groupBy([
        "m.id",
        "m.name",
        "m.email",
        "m.phone",
        "m.avatar_url",
        "m.status",
        "m.joined_at",
        "m.last_login_at",
      ])
      .orderBy(sql.raw(sortColumn), sortOrder === "asc" ? "asc" : "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      members: members.map(({ spent_inr, spent_usd, ...rest }) => ({
        ...rest,
        total_spent: makeRevenueBreakdown(
          parseFloat(String(spent_inr)),
          parseFloat(String(spent_usd)),
        ),
      })),
      total: countResult.total,
      page,
      limit,
    };
  }

  async findById(
    tenantId: string,
    memberId: string
  ): Promise<MemberDetail | undefined> {
    const row = await db
      .selectFrom("tenant_members")
      .select([
        "id",
        "name",
        "email",
        "phone",
        "avatar_url",
        "status",
        "email_verified",
        "phone_verified",
        "oauth_provider",
        "joined_at",
        "last_login_at",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .executeTakeFirst();

    return row as MemberDetail | undefined;
  }

  async updateStatus(
    tenantId: string,
    memberId: string,
    status: member_status
  ): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({ status, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .execute();
  }

  /**
   * Deactivate every live session belonging to a member, so their next request
   * on the learner app is rejected and reactivating them later requires a fresh
   * login rather than resurrecting the session that was open at suspension time.
   *
   * The learner-api independently refuses non-ACTIVE members on every request
   * (it joins `tenant_members.status` into its session lookup), so this is not
   * what enforces the suspension, it is what stops a revoked session from
   * quietly coming back to life.
   *
   * Returns the number of sessions closed, for the audit log line.
   */
  async deactivateSessionsForMember(
    tenantId: string,
    memberId: string
  ): Promise<number> {
    const result = await db
      .updateTable("tenant_member_sessions")
      .set({ is_active: false })
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("is_active", "=", true)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  async findIdByEmail(
    tenantId: string,
    email: string,
    excludeMemberId: string
  ): Promise<string | undefined> {
    const row = await db
      .selectFrom("tenant_members")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("email", "=", email)
      .where("id", "!=", excludeMemberId)
      .executeTakeFirst();
    return row?.id;
  }

  async findIdByPhone(
    tenantId: string,
    phone: string,
    excludeMemberId: string
  ): Promise<string | undefined> {
    const row = await db
      .selectFrom("tenant_members")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("phone", "=", phone)
      .where("id", "!=", excludeMemberId)
      .executeTakeFirst();
    return row?.id;
  }

  async updateProfile(
    tenantId: string,
    memberId: string,
    patch: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      email_verified?: boolean;
      phone_verified?: boolean;
    }
  ): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({ ...patch, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .execute();
  }

  async getEnrollments(
    tenantId: string,
    memberId: string
  ): Promise<MemberEnrollment[]> {
    const rows = await db
      .selectFrom("enrollments as e")
      .innerJoin("courses as c", "c.id", "e.course_id")
      .select([
        "e.id",
        "e.course_id",
        "c.title as course_title",
        "c.mode as course_mode",
        "e.status",
        "e.source",
        "e.enrolled_at",
        "e.completed_at",
        "e.valid_till",
      ])
      .where("e.tenant_id", "=", tenantId)
      .where("e.tenant_member_id", "=", memberId)
      .orderBy("e.enrolled_at", "desc")
      .execute();

    const enrollmentIds = rows.map((r) => ({
      courseId: r.course_id,
      memberId,
    }));

    const progressMap = new Map<string, number>();
    if (enrollmentIds.length > 0) {
      const courseIds = rows.map((r) => r.course_id);

      const progressRows = await db
        .selectFrom("member_lecture_progress as mlp")
        .innerJoin("lectures as l", "l.id", "mlp.lecture_id")
        .innerJoin("course_lessons as cl", "cl.id", "l.lesson_id")
        .innerJoin("course_sections as cs", "cs.id", "cl.section_id")
        .select([
          "mlp.course_id",
          sql<number>`count(*)::int`.as("total_lectures"),
          sql<number>`count(*) filter (where mlp.completed = true)::int`.as(
            "completed_lectures"
          ),
        ])
        .where("mlp.tenant_id", "=", tenantId)
        .where("mlp.tenant_member_id", "=", memberId)
        .where("mlp.course_id", "in", courseIds)
        .groupBy("mlp.course_id")
        .execute();

      for (const p of progressRows) {
        const pct =
          p.total_lectures > 0
            ? Math.round((p.completed_lectures / p.total_lectures) * 100)
            : 0;
        progressMap.set(p.course_id, pct);
      }
    }

    return rows.map((r) => ({
      ...r,
      progress_percent: progressMap.get(r.course_id) ?? 0,
    })) as MemberEnrollment[];
  }

  async getBookAccess(
    tenantId: string,
    memberId: string
  ): Promise<MemberBookAccess[]> {
    return db
      .selectFrom("book_access as ba")
      .innerJoin("books as b", "b.id", "ba.book_id")
      .select([
        "ba.id",
        "ba.book_id",
        "b.title as book_title",
        "ba.status",
        "ba.source",
        "ba.valid_till",
        "ba.created_at",
      ])
      .where("ba.tenant_id", "=", tenantId)
      .where("ba.tenant_member_id", "=", memberId)
      .orderBy("ba.created_at", "desc")
      .execute() as Promise<MemberBookAccess[]>;
  }

  async getOrders(
    tenantId: string,
    memberId: string
  ): Promise<MemberOrder[]> {
    // Exclude WALLET_TOPUP orders, those are end-user AI wallet recharges,
    // not relevant for tenant admin member order history.
    return db
      .selectFrom("payment_orders")
      .select([
        "id",
        "order_number",
        "order_type",
        "base_amount",
        "discount_amount",
        "total_amount",
        "currency",
        "coupon_code_snapshot",
        "gateway_provider_name",
        "status",
        "paid_at",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .orderBy("created_at", "desc")
      .execute() as Promise<MemberOrder[]>;
  }

  async getCertificates(
    tenantId: string,
    memberId: string
  ): Promise<MemberCertificate[]> {
    return db
      .selectFrom("certificates as cert")
      .innerJoin("courses as c", "c.id", "cert.course_id")
      .select([
        "cert.id",
        "cert.course_id",
        "c.title as course_title",
        "cert.certificate_number",
        "cert.status",
        "cert.issued_at",
      ])
      .where("cert.tenant_id", "=", tenantId)
      .where("cert.tenant_member_id", "=", memberId)
      .orderBy("cert.issued_at", "desc")
      .execute() as Promise<MemberCertificate[]>;
  }

  async getStats(tenantId: string): Promise<MemberStats> {
    const result = await db
      .selectFrom("tenant_members")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where status = 'ACTIVE')::int`.as(
          "active"
        ),
        sql<number>`count(*) filter (where status = 'SUSPENDED')::int`.as(
          "suspended"
        ),
        sql<number>`count(*) filter (where joined_at >= now() - interval '30 days')::int`.as(
          "new_30d"
        ),
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();

    return {
      total_members: result.total,
      active_members: result.active,
      suspended_members: result.suspended,
      new_members_30d: result.new_30d,
    };
  }

  async grantEnrollment(
    tenantId: string,
    memberId: string,
    courseId: string,
    enrollmentId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .insertInto("enrollments")
      .values({
        id: enrollmentId,
        tenant_id: tenantId,
        tenant_member_id: memberId,
        course_id: courseId,
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        enrolled_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }

  async revokeEnrollment(
    tenantId: string,
    enrollmentId: string
  ): Promise<void> {
    const now = new Date();
    await db
      .updateTable("enrollments")
      .set({ status: "CANCELLED", valid_till: now, updated_at: now })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

  async findEnrollmentById(
    tenantId: string,
    enrollmentId: string
  ): Promise<{ id: string; tenant_member_id: string } | undefined> {
    return db
      .selectFrom("enrollments")
      .select(["id", "tenant_member_id"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .executeTakeFirst();
  }

  async updateEnrollmentValidity(
    tenantId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await db
      .updateTable("enrollments")
      .set({ valid_till: validTill, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

  async grantBookAccess(
    tenantId: string,
    memberId: string,
    bookId: string,
    accessId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .insertInto("book_access")
      .values({
        id: accessId,
        tenant_id: tenantId,
        tenant_member_id: memberId,
        book_id: bookId,
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }

  async revokeBookAccess(
    tenantId: string,
    accessId: string
  ): Promise<void> {
    const now = new Date();
    await db
      .updateTable("book_access")
      .set({ status: "CANCELLED", valid_till: now, updated_at: now })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", accessId)
      .execute();
  }

  async findBookAccessById(
    tenantId: string,
    accessId: string
  ): Promise<{ id: string; tenant_member_id: string } | undefined> {
    return db
      .selectFrom("book_access")
      .select(["id", "tenant_member_id"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", accessId)
      .executeTakeFirst();
  }

  async updateBookAccessValidity(
    tenantId: string,
    accessId: string,
    validTill: Date | null
  ): Promise<void> {
    await db
      .updateTable("book_access")
      .set({ valid_till: validTill, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", accessId)
      .execute();
  }

  async getPublishedCourses(
    tenantId: string
  ): Promise<{ id: string; title: string; mode: string }[]> {
    return db
      .selectFrom("courses")
      .select(["id", "title", "mode"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED")
      .orderBy("title", "asc")
      .execute();
  }

  async getPublishedBooks(
    tenantId: string
  ): Promise<{ id: string; title: string }[]> {
    return db
      .selectFrom("books")
      .select(["id", "title"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED")
      .orderBy("title", "asc")
      .execute();
  }

  async getDetailStats(
    tenantId: string,
    memberId: string
  ): Promise<MemberDetailStats> {
    const result = await db
      .selectFrom("tenant_members as m")
      .select([
        sql<number>`(select count(*)::int from enrollments where tenant_id = ${tenantId} and tenant_member_id = ${memberId})`.as(
          "enrollment_count"
        ),
        sql<number>`(select count(*)::int from book_access where tenant_id = ${tenantId} and tenant_member_id = ${memberId})`.as(
          "book_access_count"
        ),
        sql<number>`(select count(*)::int from certificates where tenant_id = ${tenantId} and tenant_member_id = ${memberId})`.as(
          "certificate_count"
        ),
        sql<number>`(select count(*)::int from payment_orders where tenant_id = ${tenantId} and tenant_member_id = ${memberId})`.as(
          "order_count"
        ),
        sql<string>`coalesce((select sum(total_amount) from payment_orders where tenant_id = ${tenantId} and tenant_member_id = ${memberId} and status = 'PAID' and currency = 'INR'), '0')`.as(
          "spent_inr"
        ),
        sql<string>`coalesce((select sum(total_amount) from payment_orders where tenant_id = ${tenantId} and tenant_member_id = ${memberId} and status = 'PAID' and currency = 'USD'), '0')`.as(
          "spent_usd"
        ),
      ])
      .where("m.tenant_id", "=", tenantId)
      .where("m.id", "=", memberId)
      .executeTakeFirstOrThrow();

    const { spent_inr, spent_usd, ...rest } = result;
    return {
      ...rest,
      total_spent: makeRevenueBreakdown(
        parseFloat(String(spent_inr)),
        parseFloat(String(spent_usd)),
      ),
    };
  }

  async getCartItems(
    tenantId: string,
    memberId: string
  ): Promise<MemberCartItem[]> {
    const rows = await db
      .selectFrom("cart_items as ci")
      .leftJoin("courses as c", "c.id", "ci.course_id")
      .leftJoin("books as b", "b.id", "ci.book_id")
      .leftJoin("bundles as bun", "bun.id", "ci.bundle_id")
      .select([
        "ci.id",
        "ci.item_type",
        sql<string>`coalesce(c.title, b.title, bun.title, 'Unknown')`.as(
          "item_title"
        ),
        "ci.coupon_code",
        "ci.created_at",
      ])
      .where("ci.tenant_id", "=", tenantId)
      .where("ci.tenant_member_id", "=", memberId)
      .orderBy("ci.created_at", "desc")
      .execute();

    return rows as MemberCartItem[];
  }

  async getCouponRedemptions(
    tenantId: string,
    memberId: string
  ): Promise<MemberCouponRedemption[]> {
    return db
      .selectFrom("coupon_redemptions as cr")
      .innerJoin("coupons as cp", "cp.id", "cr.coupon_id")
      .innerJoin("payment_orders as po", "po.id", "cr.order_id")
      .select([
        "cr.id",
        "cp.code as coupon_code",
        "cp.discount_type as coupon_discount_type",
        "cp.discount_value as coupon_discount_value",
        "po.order_number",
        "cr.discount_amount",
        "cr.currency",
        "cr.created_at",
      ])
      .where("cr.tenant_id", "=", tenantId)
      .where("cr.member_id", "=", memberId)
      .orderBy("cr.created_at", "desc")
      .execute() as Promise<MemberCouponRedemption[]>;
  }

  async getRefunds(
    tenantId: string,
    memberId: string
  ): Promise<MemberRefund[]> {
    return db
      .selectFrom("refunds as r")
      .innerJoin("payment_orders as po", "po.id", "r.order_id")
      .select([
        "r.id",
        "r.order_id",
        "po.order_number",
        "r.amount",
        "r.reason",
        "r.status",
        "r.processed_at",
        "r.created_at",
      ])
      .where("r.tenant_id", "=", tenantId)
      .where("po.tenant_member_id", "=", memberId)
      .orderBy("r.created_at", "desc")
      .execute() as Promise<MemberRefund[]>;
  }

  async findExistingEnrollment(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<{ id: string; status: string } | undefined> {
    return db
      .selectFrom("enrollments")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("course_id", "=", courseId)
      .executeTakeFirst();
  }

  async findExistingBookAccess(
    tenantId: string,
    memberId: string,
    bookId: string
  ): Promise<{ id: string; status: string } | undefined> {
    return db
      .selectFrom("book_access")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("book_id", "=", bookId)
      .executeTakeFirst();
  }

  async reactivateEnrollment(
    tenantId: string,
    enrollmentId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("enrollments")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

  async reactivateBookAccess(
    tenantId: string,
    accessId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("book_access")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", accessId)
      .execute();
  }

  // ---------------------------------------------------------------------------
  // Batch enrollment helpers (Phase 4 of bulk-user-onboarding-plan).
  // ---------------------------------------------------------------------------

  async findExistingBatchEnrollment(
    tenantId: string,
    batchId: string,
    memberId: string,
    trx?: Transaction<DB>
  ): Promise<{ id: string; status: string } | undefined> {
    return (trx || db)
      .selectFrom("batch_enrollments")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .where("tenant_member_id", "=", memberId)
      .executeTakeFirst();
  }

  async grantBatchEnrollment(
    tenantId: string,
    batchId: string,
    memberId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<string> {
    const id = ulid();
    const now = new Date();
    await (trx || db)
      .insertInto("batch_enrollments")
      .values({
        id,
        tenant_id: tenantId,
        batch_id: batchId,
        tenant_member_id: memberId,
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        joined_at: now,
        created_at: now,
        updated_at: now,
      })
      .execute();
    return id;
  }

  async reactivateBatchEnrollment(
    tenantId: string,
    batchEnrollmentId: string,
    validTill: Date | null = null,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("batch_enrollments")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", batchEnrollmentId)
      .execute();
  }

  /**
   * Paginated list of member IDs matching a status/search filter. Used by the
   * companion bulk-enroll flow's "select all matching filter" mode so we can
   * resolve the target set in 500-row batches instead of materializing 10k
   * ids in the request payload.
   */
  async findMemberIdsByFilter(
    tenantId: string,
    filter: { status?: member_status; search?: string },
    offset: number,
    limit: number
  ): Promise<Array<{ id: string; status: member_status }>> {
    let q = db
      .selectFrom("tenant_members")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId);
    if (filter.status) q = q.where("status", "=", filter.status);
    if (filter.search) {
      const term = `%${filter.search}%`;
      q = q.where((eb) =>
        eb.or([
          eb("name", "ilike", term),
          eb("email", "ilike", term),
          eb("phone", "ilike", term),
        ])
      );
    }
    return q.orderBy("id", "asc").offset(offset).limit(limit).execute();
  }

  async findByIds(
    tenantId: string,
    ids: string[]
  ): Promise<Array<{ id: string; status: member_status }>> {
    if (ids.length === 0) return [];
    return db
      .selectFrom("tenant_members")
      .select(["id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();
  }

  // ---------------------------------------------------------------------------
  // Bulk-import helpers (Section 2 of tasks/bulk-user-onboarding-plan.md).
  // ---------------------------------------------------------------------------

  async findByEmail(
    tenantId: string,
    email: string,
    trx?: Transaction<DB>
  ): Promise<{ id: string; status: member_status; email: string | null; phone: string | null } | undefined> {
    return (trx || db)
      .selectFrom("tenant_members")
      .select(["id", "status", "email", "phone"])
      .where("tenant_id", "=", tenantId)
      .where("email", "=", email)
      .executeTakeFirst();
  }

  async findByPhone(
    tenantId: string,
    phone: string,
    trx?: Transaction<DB>
  ): Promise<{ id: string; status: member_status; email: string | null; phone: string | null } | undefined> {
    return (trx || db)
      .selectFrom("tenant_members")
      .select(["id", "status", "email", "phone"])
      .where("tenant_id", "=", tenantId)
      .where("phone", "=", phone)
      .executeTakeFirst();
  }

  /**
   * Create a bulk-onboarded member. password_hash is left NULL so the user can
   * recover via the existing tenant password-reset / OTP-login flows.
   * email_verified and phone_verified stay false.
   * invited_by tracks the tenant_user who ran the import.
   */
  async createMember(
    input: {
      tenantId: string;
      name: string;
      email: string | null;
      phone: string | null;
      invitedBy: string;
    },
    trx?: Transaction<DB>
  ): Promise<string> {
    const id = ulid();
    const now = new Date();
    await (trx || db)
      .insertInto("tenant_members")
      .values({
        id,
        tenant_id: input.tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        invited_by: input.invitedBy,
        status: "ACTIVE",
        joined_at: now,
        created_at: now,
        updated_at: now,
      })
      .execute();
    return id;
  }

  /**
   * Add a phone to an existing email-only member. Race-safe: the WHERE NOT
   * EXISTS guard inside the same statement closes the race window between two
   * concurrent imports trying to claim the same phone for two different
   * members. Returns true if the merge happened, false if the phone was
   * grabbed by another worker first.
   */
  async mergePhoneIntoMember(
    tenantId: string,
    memberId: string,
    phone: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .updateTable("tenant_members")
      .set({ phone, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("tenant_members as conflict")
              .select("conflict.id")
              .where("conflict.tenant_id", "=", tenantId)
              .where("conflict.phone", "=", phone)
          )
        )
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) > 0;
  }

  /**
   * Mirror of mergePhoneIntoMember. Adds an email to an existing phone-only
   * member while preserving uniqueness atomically.
   */
  async mergeEmailIntoMember(
    tenantId: string,
    memberId: string,
    email: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .updateTable("tenant_members")
      .set({ email, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", memberId)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("tenant_members as conflict")
              .select("conflict.id")
              .where("conflict.tenant_id", "=", tenantId)
              .where("conflict.email", "=", email)
          )
        )
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // BULK helpers (Phase 9 SQL optimization).
  // Each method collapses what used to be N round trips into one.
  // ---------------------------------------------------------------------------

  /**
   * One query that fetches every member in the tenant whose email is in
   * `emails` OR whose phone is in `phones`. Returns the matched rows; the
   * caller builds Map<email,…> and Map<phone,…> in memory.
   *
   * If both arrays are empty, returns [] without hitting the DB.
   */
  async batchLookupByContact(
    tenantId: string,
    emails: string[],
    phones: string[],
    trx?: Transaction<DB>
  ): Promise<MemberContactSnapshot[]> {
    if (emails.length === 0 && phones.length === 0) return [];
    return (trx || db)
      .selectFrom("tenant_members")
      .select(["id", "status", "email", "phone"])
      .where("tenant_id", "=", tenantId)
      .where((eb) => {
        const ors = [] as ReturnType<typeof eb>[];
        if (emails.length > 0) ors.push(eb("email", "in", emails));
        if (phones.length > 0) ors.push(eb("phone", "in", phones));
        return eb.or(ors);
      })
      .execute();
  }

  /**
   * Bulk-create tenant_members. `onConflict do nothing` guards against
   * concurrent imports racing on the unique (tenant_id, email) and
   * (tenant_id, phone) constraints; rows that conflict are silently skipped
   * and won't appear in the returned set, which the caller treats as a
   * race-loss for that row.
   */
  async bulkCreateMembers(
    tenantId: string,
    items: Array<{
      name: string;
      email: string | null;
      phone: string | null;
      invitedBy: string;
    }>,
    trx?: Transaction<DB>
  ): Promise<Array<{ id: string; email: string | null; phone: string | null }>> {
    if (items.length === 0) return [];
    const now = new Date();
    const rows = await (trx || db)
      .insertInto("tenant_members")
      .values(
        items.map((i) => ({
          id: ulid(),
          tenant_id: tenantId,
          name: i.name,
          email: i.email,
          phone: i.phone,
          invited_by: i.invitedBy,
          status: "ACTIVE" as member_status,
          joined_at: now,
          created_at: now,
          updated_at: now,
        }))
      )
      .onConflict((oc) => oc.doNothing())
      .returning(["id", "email", "phone"])
      .execute();
    return rows;
  }

  /**
   * Batch-merge phones into existing email-only members. Single UPDATE
   * statement with two safety guards:
   *   1. NOT EXISTS subquery, no other member in this tenant already has
   *      this phone (race against another import claiming it).
   *   2. `tm.phone IS NULL`, only fill empty slots; we never overwrite a
   *      phone that was set after the matcher's lookup ran.
   * Returns the set of memberIds whose phone was actually written; absent
   * ids are race-losses or "phone slot already filled" cases.
   */
  async bulkMergePhones(
    tenantId: string,
    items: Array<{ memberId: string; phone: string }>,
    trx?: Transaction<DB>
  ): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    const valuesFragment = sql.join(
      items.map((i) => sql`(${i.memberId}::text, ${i.phone}::text)`),
      sql`, `
    );
    const result = await sql<{ id: string }>`
      UPDATE tenant_members AS tm
      SET phone = data.new_phone, updated_at = now()
      FROM (VALUES ${valuesFragment}) AS data(member_id, new_phone)
      WHERE tm.tenant_id = ${tenantId}
        AND tm.id = data.member_id
        AND tm.phone IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM tenant_members other
          WHERE other.tenant_id = ${tenantId} AND other.phone = data.new_phone
        )
      RETURNING tm.id
    `.execute(trx ?? db);
    return new Set(result.rows.map((r) => r.id));
  }

  /**
   * Mirror of bulkMergePhones for email merges, with the same two guards:
   * NOT EXISTS to detect cross-import races, and `tm.email IS NULL` to
   * avoid overwriting an email that was filled in between our lookup and
   * our merge.
   */
  async bulkMergeEmails(
    tenantId: string,
    items: Array<{ memberId: string; email: string }>,
    trx?: Transaction<DB>
  ): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    const valuesFragment = sql.join(
      items.map((i) => sql`(${i.memberId}::text, ${i.email}::text)`),
      sql`, `
    );
    const result = await sql<{ id: string }>`
      UPDATE tenant_members AS tm
      SET email = data.new_email, updated_at = now()
      FROM (VALUES ${valuesFragment}) AS data(member_id, new_email)
      WHERE tm.tenant_id = ${tenantId}
        AND tm.id = data.member_id
        AND tm.email IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM tenant_members other
          WHERE other.tenant_id = ${tenantId} AND other.email = data.new_email
        )
      RETURNING tm.id
    `.execute(trx ?? db);
    return new Set(result.rows.map((r) => r.id));
  }

  /**
   * Bulk-fetch existing enrollments for a (course, member-set) pair.
   * Returns a Map keyed by tenant_member_id.
   */
  async bulkFindEnrollmentsForCourse(
    tenantId: string,
    courseId: string,
    memberIds: string[],
    trx?: Transaction<DB>
  ): Promise<Map<string, { id: string; status: enrollment_status }>> {
    if (memberIds.length === 0) return new Map();
    const rows = await (trx || db)
      .selectFrom("enrollments")
      .select(["id", "tenant_member_id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .where("tenant_member_id", "in", memberIds)
      .execute();
    return new Map(rows.map((r) => [r.tenant_member_id, { id: r.id, status: r.status }]));
  }

  async bulkInsertEnrollments(
    tenantId: string,
    courseId: string,
    memberIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (memberIds.length === 0) return;
    const now = new Date();
    await (trx || db)
      .insertInto("enrollments")
      .values(
        memberIds.map((memberId) => ({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: memberId,
          course_id: courseId,
          status: "ACTIVE" as enrollment_status,
          source: "ADMIN_GRANT" as const,
          valid_till: validTill,
          enrolled_at: now,
          created_at: now,
          updated_at: now,
        }))
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async bulkReactivateEnrollments(
    tenantId: string,
    enrollmentIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (enrollmentIds.length === 0) return;
    await (trx || db)
      .updateTable("enrollments")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", enrollmentIds)
      .execute();
  }

  // Same trio for book_access.
  async bulkFindBookAccessForBook(
    tenantId: string,
    bookId: string,
    memberIds: string[],
    trx?: Transaction<DB>
  ): Promise<Map<string, { id: string; status: enrollment_status }>> {
    if (memberIds.length === 0) return new Map();
    const rows = await (trx || db)
      .selectFrom("book_access")
      .select(["id", "tenant_member_id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("book_id", "=", bookId)
      .where("tenant_member_id", "in", memberIds)
      .execute();
    return new Map(rows.map((r) => [r.tenant_member_id, { id: r.id, status: r.status }]));
  }

  async bulkInsertBookAccess(
    tenantId: string,
    bookId: string,
    memberIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (memberIds.length === 0) return;
    const now = new Date();
    await (trx || db)
      .insertInto("book_access")
      .values(
        memberIds.map((memberId) => ({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: memberId,
          book_id: bookId,
          status: "ACTIVE" as enrollment_status,
          source: "ADMIN_GRANT" as const,
          valid_till: validTill,
          created_at: now,
          updated_at: now,
        }))
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async bulkReactivateBookAccess(
    tenantId: string,
    accessIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (accessIds.length === 0) return;
    await (trx || db)
      .updateTable("book_access")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", accessIds)
      .execute();
  }

  // Same trio for batch_enrollments.
  async bulkFindBatchEnrollments(
    tenantId: string,
    batchId: string,
    memberIds: string[],
    trx?: Transaction<DB>
  ): Promise<Map<string, { id: string; status: enrollment_status }>> {
    if (memberIds.length === 0) return new Map();
    const rows = await (trx || db)
      .selectFrom("batch_enrollments")
      .select(["id", "tenant_member_id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .where("tenant_member_id", "in", memberIds)
      .execute();
    return new Map(rows.map((r) => [r.tenant_member_id, { id: r.id, status: r.status }]));
  }

  async bulkInsertBatchEnrollments(
    tenantId: string,
    batchId: string,
    memberIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (memberIds.length === 0) return;
    const now = new Date();
    await (trx || db)
      .insertInto("batch_enrollments")
      .values(
        memberIds.map((memberId) => ({
          id: ulid(),
          tenant_id: tenantId,
          batch_id: batchId,
          tenant_member_id: memberId,
          status: "ACTIVE" as enrollment_status,
          source: "ADMIN_GRANT" as const,
          valid_till: validTill,
          joined_at: now,
          created_at: now,
          updated_at: now,
        }))
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async bulkReactivateBatchEnrollments(
    tenantId: string,
    ids: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (ids.length === 0) return;
    await (trx || db)
      .updateTable("batch_enrollments")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();
  }

  // Same trio for test_series_enrollments.
  async bulkFindTestSeriesEnrollments(
    tenantId: string,
    testSeriesId: string,
    memberIds: string[],
    trx?: Transaction<DB>
  ): Promise<Map<string, { id: string; status: test_series_enrollment_status }>> {
    if (memberIds.length === 0) return new Map();
    const rows = await (trx || db)
      .selectFrom("test_series_enrollments")
      .select(["id", "tenant_member_id", "status"])
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", testSeriesId)
      .where("tenant_member_id", "in", memberIds)
      .execute();
    return new Map(rows.map((r) => [r.tenant_member_id, { id: r.id, status: r.status }]));
  }

  async bulkInsertTestSeriesEnrollments(
    tenantId: string,
    testSeriesId: string,
    memberIds: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (memberIds.length === 0) return;
    const now = new Date();
    await (trx || db)
      .insertInto("test_series_enrollments")
      .values(
        memberIds.map((memberId) => ({
          id: ulid(),
          tenant_id: tenantId,
          tenant_member_id: memberId,
          test_series_id: testSeriesId,
          status: "ACTIVE" as test_series_enrollment_status,
          source: "ADMIN_GRANT" as const,
          valid_till: validTill,
          enrolled_at: now,
          created_at: now,
          updated_at: now,
        }))
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async bulkReactivateTestSeriesEnrollments(
    tenantId: string,
    ids: string[],
    validTill: Date | null,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (ids.length === 0) return;
    await (trx || db)
      .updateTable("test_series_enrollments")
      .set({
        status: "ACTIVE",
        source: "ADMIN_GRANT",
        valid_till: validTill,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute();
  }

  // ─── Member-detail lists + single revoke/validity for the access-managed
  //     grant types (batch / test series) ───────────

  async getBatchEnrollments(
    tenantId: string,
    memberId: string
  ): Promise<Array<{
    id: string;
    batch_id: string;
    batch_title: string;
    status: enrollment_status;
    source: string;
    joined_at: Date;
    valid_till: Date | null;
  }>> {
    return db
      .selectFrom("batch_enrollments as be")
      .innerJoin("batches as b", "b.id", "be.batch_id")
      .select([
        "be.id",
        "be.batch_id",
        "b.title as batch_title",
        "be.status",
        "be.source",
        "be.joined_at",
        "be.valid_till",
      ])
      .where("be.tenant_id", "=", tenantId)
      .where("be.tenant_member_id", "=", memberId)
      .orderBy("be.joined_at", "desc")
      .execute();
  }

  async findBatchEnrollmentById(
    tenantId: string,
    enrollmentId: string
  ): Promise<{ id: string; tenant_member_id: string; batch_id: string } | undefined> {
    return db
      .selectFrom("batch_enrollments")
      .select(["id", "tenant_member_id", "batch_id"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .executeTakeFirst();
  }

  /**
   * Cancels the batch enrollment AND the per-child course/book rows that the
   * grant fan-out stamped with source_batch_id, so revoking the batch really
   * removes content access (children granted by other sources are untouched).
   */
  async revokeBatchEnrollment(
    tenantId: string,
    memberId: string,
    enrollmentId: string,
    batchId: string
  ): Promise<void> {
    const now = new Date();
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("batch_enrollments")
        .set({ status: "CANCELLED", valid_till: now, updated_at: now })
        .where("tenant_id", "=", tenantId)
        .where("id", "=", enrollmentId)
        .execute();
      await trx
        .updateTable("enrollments")
        .set({ status: "CANCELLED", valid_till: now, updated_at: now })
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("source_batch_id", "=", batchId)
        .execute();
      await trx
        .updateTable("book_access")
        .set({ status: "CANCELLED", valid_till: now, updated_at: now })
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("source_batch_id", "=", batchId)
        .execute();
    });
  }

  async updateBatchEnrollmentValidity(
    tenantId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await db
      .updateTable("batch_enrollments")
      .set({ valid_till: validTill, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

  async getTestSeriesEnrollments(
    tenantId: string,
    memberId: string
  ): Promise<Array<{
    id: string;
    test_series_id: string;
    test_series_title: string;
    status: test_series_enrollment_status;
    source: string;
    enrolled_at: Date;
    valid_till: Date | null;
  }>> {
    return db
      .selectFrom("test_series_enrollments as tse")
      .innerJoin("test_series as ts", "ts.id", "tse.test_series_id")
      .select([
        "tse.id",
        "tse.test_series_id",
        "ts.title as test_series_title",
        "tse.status",
        "tse.source",
        "tse.enrolled_at",
        "tse.valid_till",
      ])
      .where("tse.tenant_id", "=", tenantId)
      .where("tse.tenant_member_id", "=", memberId)
      .orderBy("tse.enrolled_at", "desc")
      .execute();
  }

  async findTestSeriesEnrollmentById(
    tenantId: string,
    enrollmentId: string
  ): Promise<{ id: string; tenant_member_id: string } | undefined> {
    return db
      .selectFrom("test_series_enrollments")
      .select(["id", "tenant_member_id"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .executeTakeFirst();
  }

  async revokeTestSeriesEnrollment(
    tenantId: string,
    enrollmentId: string
  ): Promise<void> {
    const now = new Date();
    await db
      .updateTable("test_series_enrollments")
      .set({ status: "CANCELLED", valid_till: now, updated_at: now })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

  async updateTestSeriesEnrollmentValidity(
    tenantId: string,
    enrollmentId: string,
    validTill: Date | null
  ): Promise<void> {
    await db
      .updateTable("test_series_enrollments")
      .set({ valid_till: validTill, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", enrollmentId)
      .execute();
  }

}

export default new MembersRepository();

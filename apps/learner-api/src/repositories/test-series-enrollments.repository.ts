import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, test_series_enrollments } from "../db/types";
import type {
  test_series_enrollment_status,
  test_series_enrollment_source,
} from "../db/enums";

export type TestSeriesEnrollmentRow = test_series_enrollments;

export interface CreateEnrollmentInput {
  tenant_id: string;
  tenant_member_id: string;
  test_series_id: string;
  source: string;
  source_coupon_id?: string | null;
  valid_till?: Date | null;
  payment_id?: string | null;
  amount_paid?: number | null;
}

class TestSeriesEnrollmentsRepository {
  async findByMemberAndSeries(
    tenantId: string,
    memberId: string,
    seriesId: string
  ): Promise<TestSeriesEnrollmentRow | null> {
    const row = await db
      .selectFrom("test_series_enrollments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("test_series_id", "=", seriesId)
      .executeTakeFirst();
    return (row as unknown as TestSeriesEnrollmentRow) ?? null;
  }

  async findByMember(
    tenantId: string,
    memberId: string
  ): Promise<TestSeriesEnrollmentRow[]> {
    const rows = await db
      .selectFrom("test_series_enrollments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .orderBy("enrolled_at", "desc")
      .execute();
    return rows as unknown as TestSeriesEnrollmentRow[];
  }

  async upsert(
    data: CreateEnrollmentInput,
    trx?: Transaction<DB>
  ): Promise<TestSeriesEnrollmentRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_series_enrollments")
      .values({
        id,
        tenant_id: data.tenant_id,
        tenant_member_id: data.tenant_member_id,
        test_series_id: data.test_series_id,
        status: "ACTIVE" as test_series_enrollment_status,
        source: data.source as test_series_enrollment_source,
        source_coupon_id: data.source_coupon_id ?? null,
        enrolled_at: now,
        valid_till: data.valid_till ?? null,
        payment_id: data.payment_id ?? null,
        amount_paid: (data.amount_paid ?? null) as unknown as string | null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc
          .columns(["tenant_id", "tenant_member_id", "test_series_id"])
          .doUpdateSet({
            status: "ACTIVE" as test_series_enrollment_status,
            source: data.source as test_series_enrollment_source,
            source_coupon_id: data.source_coupon_id ?? null,
            valid_till: data.valid_till ?? null,
            payment_id: data.payment_id ?? null,
            amount_paid: (data.amount_paid ?? null) as unknown as string | null,
            updated_at: now,
          })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestSeriesEnrollmentRow;
  }

  /**
   * Which of these series the member currently has live access to.
   *
   * Batched on purpose: the catalog renders every series at once, and
   * hasActiveAccess() costs a query per series. Applies the same three rules it
   * does, enrolment exists, status ACTIVE, and not past valid_till (NULL =
   * lifetime).
   */
  async findActiveSeriesIds(
    tenantId: string,
    memberId: string,
    seriesIds: string[]
  ): Promise<Set<string>> {
    if (seriesIds.length === 0) return new Set();
    const rows = await db
      .selectFrom("test_series_enrollments")
      .select("test_series_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("test_series_id", "in", seriesIds)
      .where("status", "=", "ACTIVE")
      .where((eb) =>
        eb.or([eb("valid_till", "is", null), eb("valid_till", ">=", new Date())])
      )
      .execute();
    return new Set(rows.map((r) => r.test_series_id));
  }

  async hasActiveAccess(
    tenantId: string,
    memberId: string,
    seriesId: string
  ): Promise<boolean> {
    const enrollment = await this.findByMemberAndSeries(tenantId, memberId, seriesId);
    if (!enrollment) return false;
    if (String(enrollment.status) !== "ACTIVE") return false;
    if (enrollment.valid_till && new Date(enrollment.valid_till as unknown as string) < new Date()) {
      return false;
    }
    return true;
  }
}

export default new TestSeriesEnrollmentsRepository();

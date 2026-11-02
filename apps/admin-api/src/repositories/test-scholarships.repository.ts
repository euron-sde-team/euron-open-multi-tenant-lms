import { ulid } from "ulid";

import { db } from "../db/connection";

export interface ScholarshipTier {
  min: number;
  label: string;
  amount?: number;
  currency?: string;
}

export interface CreateScholarshipInput {
  tenant_id: string;
  test_id?: string | null;
  test_series_id?: string | null;
  name: string;
  description?: string | null;
  basis?: string;
  tiers: ScholarshipTier[];
  max_awardees?: number | null;
  created_by?: string | null;
}

export interface UpdateScholarshipInput {
  name?: string;
  description?: string | null;
  basis?: string;
  tiers?: ScholarshipTier[];
  max_awardees?: number | null;
  status?: string;
}

class TestScholarshipsRepository {
  async create(data: CreateScholarshipInput) {
    const now = new Date();
    return db
      .insertInto("test_scholarships")
      .values({
        id: ulid(),
        tenant_id: data.tenant_id,
        test_id: data.test_id ?? null,
        test_series_id: data.test_series_id ?? null,
        name: data.name,
        description: data.description ?? null,
        basis: data.basis ?? "PERCENT",
        tiers: JSON.stringify(data.tiers) as unknown as object,
        max_awardees: data.max_awardees ?? null,
        status: "ACTIVE",
        created_by: data.created_by ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async list(tenantId: string) {
    return db
      .selectFrom("test_scholarships")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async findById(id: string, tenantId: string) {
    return db
      .selectFrom("test_scholarships")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async update(id: string, tenantId: string, data: UpdateScholarshipInput) {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.basis !== undefined) updateData.basis = data.basis;
    if (data.tiers !== undefined)
      updateData.tiers = JSON.stringify(data.tiers) as unknown as object;
    if (data.max_awardees !== undefined) updateData.max_awardees = data.max_awardees;
    if (data.status !== undefined) updateData.status = data.status;
    return db
      .updateTable("test_scholarships")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
  }

  async delete(id: string, tenantId: string) {
    const res = await db
      .deleteFrom("test_scholarships")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(res.numDeletedRows ?? 0) > 0;
  }

  /** Awards for the tenant (optionally a single scholarship), with member info. */
  async listAwards(tenantId: string, scholarshipId?: string, status?: string) {
    let q = db
      .selectFrom("test_scholarship_awards as a")
      .innerJoin("test_scholarships as s", "s.id", "a.scholarship_id")
      .leftJoin("tenant_members as m", "m.id", "a.member_id")
      .select([
        "a.id",
        "a.scholarship_id",
        "a.member_id",
        "a.attempt_id",
        "a.tier_label",
        "a.amount",
        "a.currency",
        "a.score",
        "a.status",
        "a.flagged_at",
        "a.decided_at",
        "s.name as scholarship_name",
        "m.name as member_name",
        "m.email as member_email",
      ])
      .where("a.tenant_id", "=", tenantId);
    if (scholarshipId) q = q.where("a.scholarship_id", "=", scholarshipId);
    if (status) q = q.where("a.status", "=", status);
    return q.orderBy("a.flagged_at", "desc").limit(1000).execute();
  }

  async updateAwardStatus(
    awardId: string,
    tenantId: string,
    status: string,
    decidedBy: string | null
  ) {
    return db
      .updateTable("test_scholarship_awards")
      .set({ status, decided_by: decidedBy, decided_at: new Date(), updated_at: new Date() })
      .where("id", "=", awardId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
  }
}

export default new TestScholarshipsRepository();

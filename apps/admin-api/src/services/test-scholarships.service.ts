import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import testScholarshipsRepository, {
  type ScholarshipTier,
} from "../repositories/test-scholarships.repository";

const VALID_BASIS = new Set(["PERCENT", "SCALED"]);
const VALID_AWARD_STATUS = new Set(["PENDING", "CONFIRMED", "REJECTED"]);

function normalizeTiers(raw: unknown): ScholarshipTier[] {
  if (!Array.isArray(raw)) throw new BadRequestError("tiers must be an array");
  const tiers = raw.map((t) => {
    const o = (t ?? {}) as Record<string, unknown>;
    const min = Number(o.min);
    if (!Number.isFinite(min)) throw new BadRequestError("Each tier needs a numeric min");
    return {
      min,
      label: String(o.label ?? "").trim() || `${min}+`,
      amount: o.amount != null && o.amount !== "" ? Number(o.amount) : undefined,
      currency: o.currency != null ? String(o.currency) : undefined,
    };
  });
  if (tiers.length === 0) throw new BadRequestError("At least one tier is required");
  return tiers.sort((a, b) => b.min - a.min);
}

function parseTiers(raw: unknown): ScholarshipTier[] {
  const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? (arr as ScholarshipTier[]) : [];
}

function toResponse(row: {
  id: string;
  test_id: string | null;
  test_series_id: string | null;
  name: string;
  description: string | null;
  basis: string;
  tiers: unknown;
  max_awardees: number | null;
  status: string;
  created_at: unknown;
}) {
  return {
    id: row.id,
    testId: row.test_id,
    testSeriesId: row.test_series_id,
    name: row.name,
    description: row.description,
    basis: row.basis,
    tiers: parseTiers(row.tiers),
    maxAwardees: row.max_awardees,
    status: row.status,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

class TestScholarshipsService {
  async create(
    tenantId: string,
    body: {
      test_id?: string | null;
      test_series_id?: string | null;
      name?: string;
      description?: string | null;
      basis?: string;
      tiers?: unknown;
      max_awardees?: number | null;
    },
    createdBy?: string
  ) {
    if (!body.name?.trim()) throw new BadRequestError("Scholarship name is required");
    if (!body.test_id && !body.test_series_id)
      throw new BadRequestError("A scholarship must map to a test or a series");
    const basis = (body.basis ?? "PERCENT").toUpperCase();
    if (!VALID_BASIS.has(basis))
      throw new BadRequestError("basis must be PERCENT or SCALED");
    const tiers = normalizeTiers(body.tiers);
    const row = await testScholarshipsRepository.create({
      tenant_id: tenantId,
      test_id: body.test_id ?? null,
      test_series_id: body.test_series_id ?? null,
      name: body.name.trim(),
      description: body.description ?? null,
      basis,
      tiers,
      max_awardees: body.max_awardees ?? null,
      created_by: createdBy ?? null,
    });
    return toResponse(row);
  }

  async list(tenantId: string) {
    const rows = await testScholarshipsRepository.list(tenantId);
    return rows.map(toResponse);
  }

  async update(
    tenantId: string,
    id: string,
    body: {
      name?: string;
      description?: string | null;
      basis?: string;
      tiers?: unknown;
      max_awardees?: number | null;
      status?: string;
    }
  ) {
    const existing = await testScholarshipsRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError("Scholarship not found");
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = body.description;
    if (body.basis !== undefined) {
      const basis = body.basis.toUpperCase();
      if (!VALID_BASIS.has(basis)) throw new BadRequestError("Invalid basis");
      patch.basis = basis;
    }
    if (body.tiers !== undefined) patch.tiers = normalizeTiers(body.tiers);
    if (body.max_awardees !== undefined) patch.max_awardees = body.max_awardees;
    if (body.status !== undefined) patch.status = body.status.toUpperCase();
    const row = await testScholarshipsRepository.update(id, tenantId, patch);
    if (!row) throw new NotFoundError("Scholarship not found");
    return toResponse(row);
  }

  async delete(tenantId: string, id: string) {
    const ok = await testScholarshipsRepository.delete(id, tenantId);
    if (!ok) throw new NotFoundError("Scholarship not found");
  }

  async listAwards(tenantId: string, scholarshipId?: string, status?: string) {
    const rows = await testScholarshipsRepository.listAwards(
      tenantId,
      scholarshipId,
      status
    );
    return rows.map((r) => ({
      id: r.id,
      scholarshipId: r.scholarship_id,
      scholarshipName: r.scholarship_name,
      memberId: r.member_id,
      memberName: r.member_name ?? "Unknown",
      memberEmail: r.member_email ?? null,
      attemptId: r.attempt_id,
      tierLabel: r.tier_label,
      amount: r.amount != null ? Number(r.amount) : null,
      currency: r.currency,
      score: r.score != null ? Number(r.score) : null,
      status: String(r.status),
      flaggedAt:
        r.flagged_at instanceof Date ? r.flagged_at.toISOString() : String(r.flagged_at),
      decidedAt:
        r.decided_at == null
          ? null
          : r.decided_at instanceof Date
            ? r.decided_at.toISOString()
            : String(r.decided_at),
    }));
  }

  async decideAward(
    tenantId: string,
    awardId: string,
    status: string,
    decidedBy?: string
  ) {
    const s = status.toUpperCase();
    if (!VALID_AWARD_STATUS.has(s) || s === "PENDING")
      throw new BadRequestError("status must be CONFIRMED or REJECTED");
    const row = await testScholarshipsRepository.updateAwardStatus(
      awardId,
      tenantId,
      s,
      decidedBy ?? null
    );
    if (!row) throw new NotFoundError("Award not found");
    return { id: row.id, status: String(row.status) };
  }
}

export default new TestScholarshipsService();

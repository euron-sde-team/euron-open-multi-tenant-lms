import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testRankCurvesRepository, {
  type CurvePoint,
  type TestRankCurveRow,
  type CreateRankCurveInput,
  type UpdateRankCurveInput,
} from "../repositories/test-rank-curves.repository";

export interface TestRankCurveResponse {
  id: string;
  tenantId: string;
  examName: string;
  year: number;
  totalCandidates: number;
  curve: CurvePoint[];
  createdAt: string;
  updatedAt: string;
}

function parseCurve(value: unknown): CurvePoint[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as CurvePoint[]) : [];
}

function toResponse(row: TestRankCurveRow): TestRankCurveResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    examName: row.exam_name,
    year: row.year,
    totalCandidates: row.total_candidates,
    curve: parseCurve(row.curve),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

/**
 * Parse a CSV string with two columns: percentile, rank.
 * Tolerates whitespace, optional header row, and BOM.
 */
export function parseRankCurveCsv(csv: string): CurvePoint[] {
  const text = csv.replace(/^\uFEFF/, "");
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const points: CurvePoint[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const cols = rows[i].split(",").map((c) => c.trim());
    if (cols.length < 2) continue;
    const a = parseFloat(cols[0]);
    const b = parseFloat(cols[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      // First row is likely a header, skip
      if (i === 0) continue;
      throw new BadRequestError(
        `Row ${i + 1}: both columns must be numeric (got "${cols[0]}", "${cols[1]}")`
      );
    }
    if (a < 0 || a > 100) {
      throw new BadRequestError(
        `Row ${i + 1}: percentile must be between 0 and 100 (got ${a})`
      );
    }
    if (b < 0) {
      throw new BadRequestError(
        `Row ${i + 1}: rank must be non-negative (got ${b})`
      );
    }
    points.push({ percentile: a, rank: Math.round(b) });
  }

  if (points.length < 2) {
    throw new BadRequestError(
      "Curve must have at least 2 (percentile, rank) data points"
    );
  }

  // Sort by percentile ascending so interpolation can do binary search later
  points.sort((p, q) => p.percentile - q.percentile);
  return points;
}

class TestRankCurvesService {
  async list(tenantId: string): Promise<TestRankCurveResponse[]> {
    const rows = await testRankCurvesRepository.findByTenant(tenantId);
    return rows.map(toResponse);
  }

  async getById(tenantId: string, id: string): Promise<TestRankCurveResponse> {
    const row = await testRankCurvesRepository.findById(id);
    if (!row) throw new NotFoundError("Rank curve not found");
    if (row.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this curve");
    return toResponse(row);
  }

  async create(
    tenantId: string,
    data: Omit<CreateRankCurveInput, "tenant_id">
  ): Promise<TestRankCurveResponse> {
    if (!data.exam_name?.trim()) throw new BadRequestError("exam_name is required");
    if (!Number.isFinite(data.year) || data.year < 1900 || data.year > 2100)
      throw new BadRequestError("year must be a valid year");
    if (!Number.isFinite(data.total_candidates) || data.total_candidates <= 0)
      throw new BadRequestError("total_candidates must be > 0");
    if (!Array.isArray(data.curve) || data.curve.length < 2)
      throw new BadRequestError("curve must have at least 2 data points");

    const row = await testRankCurvesRepository.create({
      ...data,
      tenant_id: tenantId,
      exam_name: data.exam_name.trim(),
    });
    return toResponse(row);
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateRankCurveInput
  ): Promise<TestRankCurveResponse> {
    const existing = await testRankCurvesRepository.findById(id);
    if (!existing) throw new NotFoundError("Rank curve not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this curve");
    if (data.curve !== undefined && (!Array.isArray(data.curve) || data.curve.length < 2)) {
      throw new BadRequestError("curve must have at least 2 data points");
    }
    const row = await testRankCurvesRepository.update(id, tenantId, data);
    if (!row) throw new NotFoundError("Rank curve not found");
    return toResponse(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const ok = await testRankCurvesRepository.delete(id, tenantId);
    if (!ok) throw new NotFoundError("Rank curve not found");
  }
}

export default new TestRankCurvesService();

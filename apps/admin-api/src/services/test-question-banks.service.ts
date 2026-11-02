import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testQuestionBanksRepository, {
  type TestQuestionBankRow,
  type CreateTestQuestionBankInput,
  type UpdateTestQuestionBankInput,
  type TestQuestionBanksListParams,
} from "../repositories/test-question-banks.repository";
import testEntitlementsService from "./test-entitlements.service";

export interface TestQuestionBankResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toResponse(row: TestQuestionBankRow): TestQuestionBankResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
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

class TestQuestionBanksService {
  async list(tenantId: string, params: TestQuestionBanksListParams) {
    const result = await testQuestionBanksRepository.findByTenantId(tenantId, params);
    return {
      banks: result.banks.map(toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getById(tenantId: string, bankId: string): Promise<TestQuestionBankResponse> {
    const row = await testQuestionBanksRepository.findById(bankId);
    if (!row) throw new NotFoundError("Question bank not found");
    if (row.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question bank");
    return toResponse(row);
  }

  async create(
    tenantId: string,
    data: Omit<CreateTestQuestionBankInput, "tenant_id">,
    createdBy?: string
  ): Promise<TestQuestionBankResponse> {
    await testEntitlementsService.ensureTestSeriesEnabled(tenantId);
    if (!data.name?.trim()) {
      throw new BadRequestError("Question bank name is required");
    }
    const row = await testQuestionBanksRepository.create({
      tenant_id: tenantId,
      name: data.name.trim(),
      description: data.description ?? null,
      created_by: createdBy ?? data.created_by ?? null,
    });
    return toResponse(row);
  }

  async update(
    tenantId: string,
    bankId: string,
    data: UpdateTestQuestionBankInput
  ): Promise<TestQuestionBankResponse> {
    const existing = await testQuestionBanksRepository.findById(bankId);
    if (!existing) throw new NotFoundError("Question bank not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question bank");
    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestError("Question bank name cannot be empty");
    }
    const row = await testQuestionBanksRepository.update(bankId, tenantId, {
      ...data,
      name: data.name?.trim(),
    });
    if (!row) throw new NotFoundError("Question bank not found");
    return toResponse(row);
  }

  async delete(tenantId: string, bankId: string): Promise<void> {
    const existing = await testQuestionBanksRepository.findById(bankId);
    if (!existing) throw new NotFoundError("Question bank not found");
    if (existing.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this question bank");
    const ok = await testQuestionBanksRepository.delete(bankId, tenantId);
    if (!ok) throw new NotFoundError("Question bank not found");
  }
}

export default new TestQuestionBanksService();

import { NotFoundError } from "../errors/not-found.error";
import auditLogRepository from "../repositories/audit-log.repository";
import {
  AuditLogEntry,
  AuditLogListResponse,
  AuditLogQueryParams,
  RecordAuditInput,
} from "../types/audit-log.type";
import logger from "../utils/logger";

class AuditService {
  /**
   * Record an audit log entry for a successful admin action.
   *
   * Fire-and-forget by design: the audit write is dispatched to the background
   * and the method returns immediately, so the request path never waits on
   * (nor fails because of) audit I/O. Any write failure is caught, logged, and
   * swallowed. Audit is intentionally NOT part of any DB transaction, call
   * this only AFTER the primary mutation has committed.
   */
  record(input: RecordAuditInput): Promise<void> {
    void auditLogRepository.create(input).catch((err) => {
      logger.error(
        `Failed to record audit log [${input.category}/${input.action}]: ${
          (err as Error).message
        }`
      );
    });
    return Promise.resolve();
  }

  /**
   * List audit log entries with filters + pagination.
   */
  async listAuditLogs(
    params: AuditLogQueryParams
  ): Promise<AuditLogListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 30;

    const { entries, total } = await auditLogRepository.findAll(params);

    return {
      data: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single audit log entry by id.
   */
  async getAuditLogById(id: string): Promise<AuditLogEntry> {
    const entry = await auditLogRepository.findById(id);
    if (!entry) {
      throw new NotFoundError(`Audit log entry with ID '${id}' not found`);
    }
    return entry;
  }
}

export default new AuditService();

import { getRedisClient } from "../lib/redis";
import { enqueueExport, type AnalyticsExportJobData } from "../queues/analytics-export.queue";
import { BadRequestError } from "../errors/bad-request.error";

const VALID_REPORTS = ["users", "courses", "books", "payments", "certificates", "enrollments"] as const;
const VALID_FORMATS = ["csv", "xlsx"] as const;

class AnalyticsExportService {
  async requestExport(params: {
    tenantId: string;
    report: string;
    format: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    requestedBy: string;
  }): Promise<{ jobId: string; status: string }> {
    if (!VALID_REPORTS.includes(params.report as (typeof VALID_REPORTS)[number])) {
      throw new BadRequestError(
        `Invalid report type: ${params.report}. Valid: ${VALID_REPORTS.join(", ")}`,
      );
    }
    if (!VALID_FORMATS.includes(params.format as (typeof VALID_FORMATS)[number])) {
      throw new BadRequestError(
        `Invalid format: ${params.format}. Valid: ${VALID_FORMATS.join(", ")}`,
      );
    }

    const jobId = await enqueueExport({
      tenantId: params.tenantId,
      report: params.report as AnalyticsExportJobData["report"],
      format: params.format as AnalyticsExportJobData["format"],
      startDate: params.startDate,
      endDate: params.endDate,
      search: params.search,
      requestedBy: params.requestedBy,
    });

    return { jobId, status: "queued" };
  }

  async getExportStatus(jobId: string): Promise<{
    status: string;
    rowCount?: number;
    content?: string;
    fileName?: string;
    mimeType?: string;
  }> {
    const redis = await getRedisClient();
    const raw = await redis.get(`analytics-export:${jobId}`);

    if (!raw) {
      return { status: "processing" };
    }

    return JSON.parse(raw);
  }
}

export default new AnalyticsExportService();

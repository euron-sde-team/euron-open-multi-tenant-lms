import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const QUEUE_NAME = "analytics-export";

export interface AnalyticsExportJobData {
  tenantId: string;
  report: "users" | "courses" | "books" | "payments" | "certificates" | "enrollments";
  format: "xlsx" | "csv";
  startDate?: string;
  endDate?: string;
  search?: string;
  requestedBy: string; // tenant user id
}

export const analyticsExportQueue = new Queue<AnalyticsExportJobData>(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export async function enqueueExport(data: AnalyticsExportJobData): Promise<string> {
  const job = await analyticsExportQueue.add("export", data);
  return job.id!;
}

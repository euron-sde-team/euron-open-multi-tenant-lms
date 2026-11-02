import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME } from "./analytics-export.queue";
import type { AnalyticsExportJobData } from "./analytics-export.queue";
import analyticsRepository from "../repositories/analytics.repository";
import { getRedisClient } from "../lib/redis";
import {
  REPORT_COLUMNS,
  buildRosterWorkbook,
  buildSingleSheetWorkbook,
  formatRosterRows,
  generateCSV,
} from "../lib/analytics-export-format";
import logger from "../utils/logger";

// ---------------------------------------------------------------------------
// Column definitions per report type
// ---------------------------------------------------------------------------

// Revenue / total_spent are RevenueBreakdown objects at runtime. The export
// expands them into three explicit columns (INR / USD / Combined-in-INR) so
// CSV consumers can see exactly what was paid in each currency.
// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/**
 * Expand RevenueBreakdown fields (`total_spent`, `revenue`) into flat
 * `<field>_inr`, `<field>_usd`, `<field>_combined_inr` keys so the CSV
 * column mapping can read them directly.
 */
function flattenRevenueFields(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const keysToExpand = ["total_spent", "revenue"];
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of keysToExpand) {
      const value = row[key];
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        if ("inr" in v && "usd" in v && "combined_inr" in v) {
          out[`${key}_inr`] = v.inr;
          out[`${key}_usd`] = v.usd;
          out[`${key}_combined_inr`] = v.combined_inr;
        }
      }
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Data fetchers, reuse existing analytics repository methods
// ---------------------------------------------------------------------------

async function fetchReportData(
  data: AnalyticsExportJobData,
): Promise<Record<string, unknown>[]> {
  const { tenantId, report, startDate, endDate, search } = data;
  const EXPORT_LIMIT = 10000;

  switch (report) {
    case "users": {
      const result = await analyticsRepository.getUsersAnalytics(
        tenantId, startDate, endDate, 1, EXPORT_LIMIT, search,
      );
      return (result.members ?? []) as Record<string, unknown>[];
    }
    case "courses": {
      const result = await analyticsRepository.getCoursesAnalytics(
        tenantId, startDate, endDate, 1, EXPORT_LIMIT, search,
      );
      return (result.items ?? []) as Record<string, unknown>[];
    }
    case "books": {
      const result = await analyticsRepository.getBooksAnalytics(
        tenantId, startDate, endDate, 1, EXPORT_LIMIT, search,
      );
      return (result.items ?? []) as Record<string, unknown>[];
    }
    case "payments": {
      const result = await analyticsRepository.getPaymentsAnalytics(
        tenantId, startDate, endDate, 1, EXPORT_LIMIT, search,
      );
      return (result.recent_orders ?? []) as Record<string, unknown>[];
    }
    case "certificates": {
      const result = await analyticsRepository.getCertificateDetails(
        tenantId, startDate, endDate, 1, EXPORT_LIMIT, search,
      );
      return (result.items ?? []) as Record<string, unknown>[];
    }
    case "enrollments": {
      // The roster, at enrolment grain. This used to reuse getUsersAnalytics,
      // which answers a different question (one row per member) and left the
      // course columns empty.
      const rows = await analyticsRepository.getEnrolmentRosterForExport(
        tenantId, startDate, endDate, EXPORT_LIMIT, search,
      );
      return rows as unknown as Record<string, unknown>[];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processExport(job: Job<AnalyticsExportJobData>): Promise<void> {
  const { data } = job;
  logger.info(
    `[analytics-export] Processing export: ${data.report} (${data.format}) for tenant ${data.tenantId}`,
  );

  const rawRows = await fetchReportData(data);
  const rows =
    data.report === "enrollments"
      ? formatRosterRows(rawRows)
      : flattenRevenueFields(rawRows);
  const columns = REPORT_COLUMNS[data.report] ?? [];

  if (rows.length === 0) {
    const redis = await getRedisClient();
    await redis.setEx(
      `analytics-export:${job.id}`,
      3600,
      JSON.stringify({ status: "completed", rowCount: 0, content: "", fileName: "" }),
    );
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let contentBase64: string;
  let fileName: string;
  let mimeType: string;

  if (data.format === "xlsx") {
    // The roster report ships the three-sheet workbook; every other report
    // gets its own single sheet rather than being refused.
    const userRows =
      data.report === "enrollments"
        ? flattenRevenueFields(
            (
              await analyticsRepository.getUsersAnalytics(
                data.tenantId, data.startDate, data.endDate, 1, 10000, data.search,
              )
            ).members as unknown as Record<string, unknown>[],
          )
        : [];
    const buffer =
      data.report === "enrollments"
        ? await buildRosterWorkbook(rows, userRows)
        : await buildSingleSheetWorkbook(data.report, columns, rows);
    contentBase64 = Buffer.from(buffer).toString("base64");
    fileName = `${data.report}-export-${stamp}.xlsx`;
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    contentBase64 = Buffer.from(generateCSV(rows, columns), "utf-8").toString("base64");
    fileName = `${data.report}-export-${stamp}.csv`;
    mimeType = "text/csv";
  }

  const redis = await getRedisClient();
  await redis.setEx(
    `analytics-export:${job.id}`,
    3600,
    JSON.stringify({
      status: "completed",
      rowCount: rows.length,
      content: contentBase64,
      fileName,
      mimeType,
    }),
  );

  logger.info(
    `[analytics-export] Export complete: ${rows.length} rows for ${data.report}`,
  );
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

let worker: Worker<AnalyticsExportJobData> | null = null;

export function startAnalyticsExportWorker(): Worker<AnalyticsExportJobData> {
  worker = new Worker<AnalyticsExportJobData>(QUEUE_NAME, processExport, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 3,
  });

  worker.on("failed", (job, err) => {
    logger.error(`[analytics-export] Job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function stopAnalyticsExportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

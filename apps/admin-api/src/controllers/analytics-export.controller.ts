import { Request, Response } from "express";
import analyticsExportService from "../services/analytics-export.service";
import { BadRequestError } from "../errors/bad-request.error";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const requestAnalyticsExport = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const { report, format, startDate, endDate, search } = req.body;
  if (!report) throw new BadRequestError("report is required");
  if (!format) throw new BadRequestError("format is required");

  const data = await analyticsExportService.requestExport({
    tenantId,
    report,
    format,
    startDate,
    endDate,
    search,
    requestedBy: req.tenantUser?.id ?? "unknown",
  });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Export queued",
  });
};

export const getAnalyticsExportStatus = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const jobId = String(req.params.jobId ?? "").trim();
  if (!jobId) throw new BadRequestError("Job ID is required");

  const data = await analyticsExportService.getExportStatus(jobId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Export status retrieved",
  });
};

export const downloadAnalyticsExport = async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const jobId = String(req.params.jobId ?? "").trim();
  if (!jobId) throw new BadRequestError("Job ID is required");

  const result = await analyticsExportService.getExportStatus(jobId);

  if (result.status !== "completed" || !result.content) {
    throw new BadRequestError("Export not ready or already expired");
  }

  const buffer = Buffer.from(result.content, "base64");
  res.setHeader("Content-Type", result.mimeType || "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.fileName || "export.csv"}"`,
  );
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
};

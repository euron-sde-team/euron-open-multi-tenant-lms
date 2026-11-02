import type { Request, Response } from "express";

import type { tenant_bulk_import_scope_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import bulkImportsService from "../services/bulk-imports.service";
import type { ScopeContext } from "../types/bulk-imports.type";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function requireTenantId(req: Request): string {
  if (!req.tenantId) throw new BadRequestError("Tenant context required");
  return req.tenantId;
}

function parseDryRun(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

function parseValidTill(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestError("validTill must be an ISO 8601 date.");
  }
  return d;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
  return String(value);
}

function requireFile(req: Request): { buffer: Buffer; filename: string; mimetype?: string } {
  if (!req.file) {
    throw new BadRequestError("File is required. Upload as multipart/form-data field 'file'.");
  }
  return {
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
  };
}

// ---------------------------------------------------------------------------
// Sample download
// ---------------------------------------------------------------------------

export const downloadSample = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const fmt = String(req.query.format ?? "csv").toLowerCase();
  if (fmt !== "csv" && fmt !== "xlsx") {
    throw new BadRequestError("format must be 'csv' or 'xlsx'.");
  }
  const withValidity =
    req.query.validity === "true" || req.query.validity === "1";
  const sample = await bulkImportsService.getSample(fmt, withValidity);
  res.setHeader("Content-Type", sample.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sample.filename}"`,
  );
  res.status(200).send(sample.body);
};

// ---------------------------------------------------------------------------
// Run import (tenant / course / book)
// ---------------------------------------------------------------------------

export const runTenantImport = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const scope: ScopeContext = {
    scopeType: "TENANT",
    scopeId: null,
    batchId: null,
    validTill: null, // validTill is N/A for tenant-wide
  };
  const result = await bulkImportsService.runImport({
    tenantId,
    actingUserId: req.tenantUser.id,
    file: requireFile(req),
    scope,
    dryRun: parseDryRun(req.query.dryRun),
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bulk import processed",
  });
};

export const runCourseImport = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const courseId = asString(req.params.courseId);
  if (!courseId) throw new BadRequestError("courseId is required");
  const scope: ScopeContext = {
    scopeType: "COURSE",
    scopeId: courseId,
    batchId: asString(req.query.batchId) ?? asString(req.body?.batchId),
    validTill: parseValidTill(req.query.validTill ?? req.body?.validTill),
  };
  const result = await bulkImportsService.runImport({
    tenantId,
    actingUserId: req.tenantUser.id,
    file: requireFile(req),
    scope,
    dryRun: parseDryRun(req.query.dryRun),
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course bulk enrollment processed",
  });
};

export const runBookImport = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const bookId = asString(req.params.bookId);
  if (!bookId) throw new BadRequestError("bookId is required");
  const scope: ScopeContext = {
    scopeType: "BOOK",
    scopeId: bookId,
    batchId: null,
    validTill: parseValidTill(req.query.validTill ?? req.body?.validTill),
  };
  const result = await bulkImportsService.runImport({
    tenantId,
    actingUserId: req.tenantUser.id,
    file: requireFile(req),
    scope,
    dryRun: parseDryRun(req.query.dryRun),
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Book bulk grant processed",
  });
};

// ---------------------------------------------------------------------------
// Job inspection
// ---------------------------------------------------------------------------

export const listJobs = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20),
  );
  const scopeTypeRaw = asString(req.query.scopeType);
  const scopeType = scopeTypeRaw
    ? (scopeTypeRaw.toUpperCase() as tenant_bulk_import_scope_type)
    : undefined;
  const scopeId = asString(req.query.scopeId) ?? undefined;

  const result = await bulkImportsService.listJobs(tenantId, {
    page,
    limit,
    scopeType,
    scopeId,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bulk import jobs retrieved",
  });
};

export const getJob = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const jobId = asString(req.params.jobId);
  if (!jobId) throw new BadRequestError("jobId is required");
  const job = await bulkImportsService.getJob(tenantId, jobId);
  sendSuccessResponse({
    res,
    data: job,
    statusCode: HttpSuccessStatus.OK,
    message: "Bulk import job retrieved",
  });
};

export const getJobReportUrl = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const jobId = asString(req.params.jobId);
  if (!jobId) throw new BadRequestError("jobId is required");
  const url = await bulkImportsService.getReportUrl(tenantId, jobId);
  sendSuccessResponse({
    res,
    data: { url },
    statusCode: HttpSuccessStatus.OK,
    message: "Report signed URL generated",
  });
};

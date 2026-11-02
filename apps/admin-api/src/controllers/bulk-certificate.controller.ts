import type { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import bulkCertificateService, {
  type RecipientSource,
} from "../services/bulk-certificate.service";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function requireTenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

export const downloadSample = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const fmt = String(req.query.format ?? "csv").toLowerCase();
  if (fmt !== "csv" && fmt !== "xlsx") {
    throw new BadRequestError("format must be 'csv' or 'xlsx'.");
  }
  const sample = await bulkCertificateService.getSample(fmt);
  res.setHeader("Content-Type", sample.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sample.filename}"`,
  );
  res.status(200).send(sample.body);
};

export const createBatch = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);

  if (!req.file) {
    throw new BadRequestError(
      "File is required. Upload as multipart/form-data field 'file'.",
    );
  }

  const title = asString(req.body?.title);
  if (!title) {
    throw new BadRequestError("title is required.");
  }
  const templateId = asString(req.body?.templateId);
  const certificateTemplateId = asString(req.body?.certificateTemplateId);
  if (!templateId && !certificateTemplateId) {
    throw new BadRequestError("templateId or certificateTemplateId is required.");
  }

  const result = await bulkCertificateService.createBatch(tenantId, req.tenantUser.id, {
    file: {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    },
    title,
    templateId: templateId ?? null,
    certificateTemplateId: certificateTemplateId ?? null,
    signatoryName: asString(req.body?.signatoryName),
    signatoryTitle: asString(req.body?.signatoryTitle),
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Certificates generated",
  });
};

export const listBatches = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const batches = await bulkCertificateService.listBatches(tenantId);
  sendSuccessResponse({
    res,
    data: { batches },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate batches retrieved",
  });
};

export const getBatchDetail = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const batchId = asString(req.params.batchId);
  if (!batchId) throw new BadRequestError("batchId is required.");

  const result = await bulkCertificateService.getBatchDetail(tenantId, batchId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate batch retrieved",
  });
};

export const deleteBatch = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const batchId = asString(req.params.batchId);
  if (!batchId) throw new BadRequestError("batchId is required.");

  await bulkCertificateService.deleteBatch(tenantId, batchId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate batch deleted",
  });
};

function parseSource(body: unknown): RecipientSource {
  const b = (body ?? {}) as {
    source?: {
      type?: string;
      id?: string;
      contacts?: Array<{ name?: string; email?: string }>;
    };
  };
  const src = b.source;
  if (!src || typeof src.type !== "string") {
    throw new BadRequestError(
      "source.type is required (course | book | emails).",
    );
  }
  if (src.type === "emails") {
    const contacts = Array.isArray(src.contacts) ? src.contacts : [];
    const mapped = contacts
      .map((c) => ({
        name: String(c?.name ?? "").trim(),
        email: String(c?.email ?? "").trim(),
      }))
      .filter((c) => c.email.length > 0)
      .map((c) => ({ name: c.name || c.email, email: c.email }));
    return { type: "emails", contacts: mapped };
  }
  if (src.type === "course" || src.type === "book") {
    const id = asString(src.id);
    if (!id) throw new BadRequestError(`source.id is required for ${src.type}.`);
    return { type: src.type, id };
  }
  throw new BadRequestError(`Unknown source type: ${src.type}`);
}

export const resolveRecipients = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const source = parseSource(req.body);
  const recipients = await bulkCertificateService.resolveRecipients(
    tenantId,
    source,
  );
  sendSuccessResponse({
    res,
    data: { recipients, count: recipients.length },
    statusCode: HttpSuccessStatus.OK,
    message: "Recipients resolved",
  });
};

export const createFromSource = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const title = asString(req.body?.title);
  if (!title) throw new BadRequestError("title is required.");
  const templateId = asString(req.body?.templateId);
  const certificateTemplateId = asString(req.body?.certificateTemplateId);
  if (!templateId && !certificateTemplateId) {
    throw new BadRequestError("templateId or certificateTemplateId is required.");
  }
  const source = parseSource(req.body);

  const result = await bulkCertificateService.createBatchFromSource(
    tenantId,
    req.tenantUser.id,
    {
      title,
      templateId: templateId ?? null,
      certificateTemplateId: certificateTemplateId ?? null,
      signatoryName: asString(req.body?.signatoryName),
      signatoryTitle: asString(req.body?.signatoryTitle),
      source,
    },
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Certificates generated",
  });
};

export const sendBatch = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const batchId = asString(req.params.batchId);
  if (!batchId) throw new BadRequestError("batchId is required.");

  const result = await bulkCertificateService.sendBatch(tenantId, batchId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Sent ${result.sent} certificate(s)`,
  });
};

import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import invoiceRepository from "../repositories/invoice.repository";
import { sendSuccessResponse, HttpSuccessStatus } from "../utils/response.util";

function getTenantId(req: Request): string {
  const id = req.tenant?.id;
  if (!id) throw new BadRequestError("Tenant required");
  return id;
}

function getMemberId(req: Request): string {
  const id = (req.user as { id: string } | undefined)?.id;
  if (!id) throw new BadRequestError("Authentication required");
  return id;
}

export const listMyInvoices = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const { page, limit } = req.query;

  const result = await invoiceRepository.findByMemberId(tenantId, memberId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Invoices retrieved" });
};

export const getMyInvoice = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const invoice = await invoiceRepository.findById(String(req.params.id), tenantId);

  if (!invoice || invoice.member_id !== memberId) {
    sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Invoice not found" });
    return;
  }

  sendSuccessResponse({ res, data: invoice, statusCode: HttpSuccessStatus.OK, message: "Invoice retrieved" });
};

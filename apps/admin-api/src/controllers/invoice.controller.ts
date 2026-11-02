import type { Request, Response, NextFunction } from "express";
import invoiceRepository from "../repositories/invoice.repository";
import { sendSuccessResponse, HttpSuccessStatus } from "../utils/response.util";

export const listInvoices = async (req: Request, res: Response, _next: NextFunction) => {
  const tenantId = req.tenantId!;
  const { invoice_type, page, limit } = req.query;

  const result = await invoiceRepository.findByTenantId(tenantId, {
    invoice_type: invoice_type as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Invoices retrieved" });
};

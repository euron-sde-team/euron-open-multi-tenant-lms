import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import paymentHistoryRepository from "../repositories/payment-history.repository";
import type { PaymentHistoryFilters } from "../repositories/payment-history.repository";
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

export const listPaymentHistory = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const { page, limit, source } = req.query;

  const filters: PaymentHistoryFilters = {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  };

  if (source === "ORDER" || source === "SUBSCRIPTION" || source === "ALL") {
    filters.source = source;
  }

  const result = await paymentHistoryRepository.findByMemberId(
    tenantId,
    memberId,
    filters
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Payment history retrieved",
  });
};

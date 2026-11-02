import { NextFunction, Request, Response } from "express";
import tenantSalesService from "../services/tenant-sales.service";
import {
  RevenueQueryParams,
  SalesOrdersQueryParams,
} from "../types/tenant-offerings.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/** GET /admin/tenants/:tenantId/sales/orders */
export const listSalesOrders = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: SalesOrdersQueryParams = {
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    order_type: req.query.order_type as string | undefined,
    status: req.query.status as string | undefined,
    currency: req.query.currency as string | undefined,
    start_date: req.query.start_date as string | undefined,
    end_date: req.query.end_date as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await tenantSalesService.listOrders(
    req.params.tenantId as string,
    params
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Sales orders retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/revenue/summary */
export const getRevenueSummary = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: RevenueQueryParams = {
    start_date: req.query.start_date as string | undefined,
    end_date: req.query.end_date as string | undefined,
  };
  const result = await tenantSalesService.getRevenueSummary(
    req.params.tenantId as string,
    params
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Revenue summary retrieved successfully",
  });
};

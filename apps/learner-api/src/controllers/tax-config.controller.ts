import { Request, Response } from "express";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { fetchTenantTaxConfig } from "../utils/tax.util";

export const getTaxConfig = async (req: Request, res: Response) => {
  const tenantId = req.tenant!.id;
  const config = await fetchTenantTaxConfig(tenantId);
  sendSuccessResponse({
    res,
    data: {
      tax_mode: config.taxMode,
      tax_percentage: config.taxPercentage,
      is_indian: config.isIndian,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Tax config fetched",
  });
};

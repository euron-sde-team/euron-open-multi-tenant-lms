import { Request, Response } from "express";
import config from "../config";
import { ForbiddenError } from "../errors/forbidden.error";
import gatewayConnectionService from "../services/gateway-connection.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

export const getPaymentConfig = async (_req: Request, res: Response): Promise<void> => {
  // Checkout webhooks land on learner-api, where orders are fulfilled.
  const apiBase = config.LEARNER_PUBLIC_API_BASE_URL;
  const razorpayWebhookUrl = `${apiBase}/webhooks/razorpay`;
  const stripeWebhookUrl = `${apiBase}/webhooks/stripe`;

  sendSuccessResponse({
    res,
    data: {
      // Backwards compatibility for any consumer still reading the flat field.
      razorpay_webhook_url: razorpayWebhookUrl,
      webhooks: {
        razorpay: { url: razorpayWebhookUrl },
        stripe: {
          url: stripeWebhookUrl,
          /**
           * Listed here rather than in the frontend because subscribing to the
           * wrong set is silently destructive: without the async_payment_*
           * pair, a delayed payment method (bank debit) takes the buyer's money
           * and the order is never fulfilled. Card testing never reveals it.
           */
          events: [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed",
          ],
        },
      },
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Payment config retrieved",
  });
};

export const listProviders = async (req: Request, res: Response): Promise<void> => {
  const data = await gatewayConnectionService.listProviders();
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Providers retrieved successfully",
  });
};

export const listConnections = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const data = await gatewayConnectionService.listConnections(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Gateway connections retrieved successfully",
  });
};

export const getConnection = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await gatewayConnectionService.getConnection(id, tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Gateway connection retrieved successfully",
  });
};

export const createConnection = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const data = await gatewayConnectionService.createConnection(tenantId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Gateway connection created successfully",
  });
};

export const updateConnection = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await gatewayConnectionService.updateConnection(id, tenantId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Gateway connection updated successfully",
  });
};

export const deleteConnection = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  await gatewayConnectionService.deleteConnection(id, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Gateway connection deleted successfully",
  });
};

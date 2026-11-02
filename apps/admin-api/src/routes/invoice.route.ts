import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { listInvoices } from "../controllers/invoice.controller";

const invoiceRouter: Router = Router();

invoiceRouter.use(asyncHandler(authenticateTenantUser));
invoiceRouter.get("/", asyncHandler(requirePermission("invoices.view")), asyncHandler(listInvoices));

export default invoiceRouter;

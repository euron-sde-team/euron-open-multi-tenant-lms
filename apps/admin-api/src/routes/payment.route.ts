import { Router } from "express";
import {
  createConnection,
  deleteConnection,
  getConnection,
  getPaymentConfig,
  listConnections,
  listProviders,
  updateConnection,
} from "../controllers/gateway-connection.controller";
import * as exportsController from "../controllers/exports.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

router.use(asyncHandler(authenticateTenantUser));

router.get("/config", asyncHandler(requirePermission("gateway.view")), asyncHandler(getPaymentConfig));
router.get("/providers", asyncHandler(requirePermission("gateway.view")), asyncHandler(listProviders));
router.get("/gateway-connections", asyncHandler(requirePermission("gateway.view")), asyncHandler(listConnections));
router.get("/gateway-connections/:id", asyncHandler(requirePermission("gateway.view")), asyncHandler(getConnection));
router.post("/gateway-connections", asyncHandler(requirePermission("gateway.configure")), asyncHandler(createConnection));
router.patch("/gateway-connections/:id", asyncHandler(requirePermission("gateway.configure")), asyncHandler(updateConnection));
router.delete("/gateway-connections/:id", asyncHandler(requirePermission("gateway.configure")), asyncHandler(deleteConnection));

router.get("/orders/export.csv", asyncHandler(requirePermission("payments.view")), asyncHandler(exportsController.exportPaymentOrders));

export default router;

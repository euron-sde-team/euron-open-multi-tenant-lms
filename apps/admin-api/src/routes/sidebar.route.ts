import { Router } from "express";
import {
  getSidebarConfig,
  updateNavItem,
  addCustomLink,
  deleteCustomLink,
  reorderItems,
} from "../controllers/sidebar.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const sidebarRouter: Router = Router();

sidebarRouter.use(asyncHandler(authenticateTenantUser));

// Sidebar navigation management
sidebarRouter.get("/", asyncHandler(requirePermission("settings.navigation")), asyncHandler(getSidebarConfig));
sidebarRouter.patch("/items/:id", asyncHandler(requirePermission("settings.navigation")), asyncHandler(updateNavItem));
sidebarRouter.post("/items", asyncHandler(requirePermission("settings.navigation")), asyncHandler(addCustomLink));
sidebarRouter.delete("/items/:id", asyncHandler(requirePermission("settings.navigation")), asyncHandler(deleteCustomLink));
sidebarRouter.put("/reorder", asyncHandler(requirePermission("settings.navigation")), asyncHandler(reorderItems));

export default sidebarRouter;

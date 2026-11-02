import { Router } from "express";
import { health, helloWorld } from "../controllers/health.controller";
import { asyncHandler } from "../utils/asynchandler";
import activityFeedRouter from "./activity-feed.route";
import auditLogRouter from "./audit-log.route";
import adminAuthRouter from "./admin.auth.route";
import billingProviderRouter from "./billing-provider.route";
import dashboardRouter from "./dashboard.route";
import adminPermissionRouter from "./admin.permission.route";
import adminRoleRouter from "./admin.role.route";
import adminUserRouter from "./admin.user.route";
import applicationRouter from "./application.route";
import entitlementRouter from "./entitlement.route";
import featureRouter from "./feature.route";
import memberRouter from "./member.route";
import planRouter from "./plan.route";
import productRouter from "./product.route";
import staffMemberRouter from "./staff-member.route";
import subscriptionRouter from "./subscription.route";
import tenantPermissionRouter from "./tenant-permission.route";
import tenantUserRouter from "./tenant-user.route";
import tenantAnalyticsRouter from "./tenant-analytics.route";
import tenantRouter from "./tenant.route";
import { autoAuditAdminMutations } from "../middlewares/audit-log.middleware";

const v1Router: Router = Router();

v1Router.get("/", asyncHandler(helloWorld));
v1Router.get("/health", asyncHandler(health));

// Auto-audit every state-changing admin action (actor + ip + device + geo).
// Registers a response-finish listener; the actual write is fire-and-forget.
v1Router.use(autoAuditAdminMutations);

// Admin RBAC routes
v1Router.use("/admin/auth", adminAuthRouter);
v1Router.use("/admin/users", adminUserRouter);
v1Router.use("/admin/roles", adminRoleRouter);
v1Router.use("/admin/permissions", adminPermissionRouter);

// Platform Catalog routes
v1Router.use("/admin/applications", applicationRouter);
v1Router.use("/admin/features", featureRouter);
v1Router.use("/admin/products", productRouter);
v1Router.use("/admin/plans", planRouter);

// Tenant Management & Entitlements routes
v1Router.use("/admin/tenants/permissions", tenantPermissionRouter);
v1Router.use("/admin/tenant-analytics", tenantAnalyticsRouter);
v1Router.use("/admin/tenants", tenantRouter);
v1Router.use("/admin/tenant-users", tenantUserRouter);
v1Router.use("/admin/staff-members", staffMemberRouter);
v1Router.use("/admin/members", memberRouter);
v1Router.use("/admin/entitlements", entitlementRouter);
v1Router.use("/admin/subscriptions", subscriptionRouter);
v1Router.use("/admin/billing-providers", billingProviderRouter);
v1Router.use("/admin/dashboard", dashboardRouter);
v1Router.use("/admin/activity-feed", activityFeedRouter);
v1Router.use("/admin/audit-logs", auditLogRouter);

export default v1Router;

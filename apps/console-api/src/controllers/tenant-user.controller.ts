import { NextFunction, Request, Response } from "express";
import tenantUserService from "../services/tenant-user.service";
import {
  AssignTenantUserRoleRequest,
  CreateTenantUserRequest,
  InviteTenantUserRequest,
  StaffMembershipStatus,
  TenantUserQueryParams,
  TenantUserStatus,
  UpdateTenantMembershipRequest,
  UpdateTenantUserRequest,
  UserTenantsQueryParams,
} from "../types/tenant.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Search global tenant users (for admin e.g. owner picker)
 * GET /admin/tenant-users?search=...&page=1&limit=20
 */
export const searchGlobalTenantUsers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params = {
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };

  const result = await tenantUserService.searchGlobalUsers(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant users retrieved successfully",
  });
};

/**
 * List users in a tenant (via memberships)
 * GET /admin/tenants/:tenantId/users
 */
export const listTenantUsers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: TenantUserQueryParams = {
    status: req.query.status as StaffMembershipStatus | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    include_global_suspended: req.query.include_global_suspended === "true",
  };

  const result = await tenantUserService.listUsers(tenantId as string, params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant users retrieved successfully",
  });
};

/**
 * Create a new user and add to tenant, or add existing user to tenant
 * POST /admin/tenants/:tenantId/users
 */
export const createTenantUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const adminId = req.adminUser?.id;
  const data: CreateTenantUserRequest = {
    email: req.body.email,
    name: req.body.name,
    password: req.body.password,
    role_ids: req.body.role_ids,
  };

  const user = await tenantUserService.createUser(tenantId as string, data, adminId);

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.CREATED,
    message: "User added to tenant successfully",
  });
};

/**
 * Invite an existing user to a tenant by email
 * POST /admin/tenants/:tenantId/users/invite
 */
export const inviteTenantUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const adminId = req.adminUser?.id;
  const data: InviteTenantUserRequest = {
    email: req.body.email,
    role_ids: req.body.role_ids,
    message: req.body.message,
  };

  const result = await tenantUserService.inviteUser(tenantId as string, data, adminId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "User invited to tenant successfully",
  });
};

/**
 * Get user by ID within tenant context
 * GET /admin/tenants/:tenantId/users/:id
 */
export const getTenantUserById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const user = await tenantUserService.getUserById(tenantId as string, id as string);

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant user retrieved successfully",
  });
};

/**
 * Update user's global profile fields
 * PATCH /admin/tenants/:tenantId/users/:id
 */
export const updateTenantUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: UpdateTenantUserRequest = {
    name: req.body.name,
    avatar_url: req.body.avatar_url,
    email: req.body.email,
    phone: req.body.phone,
  };

  const user = await tenantUserService.updateUser(tenantId as string, id as string, data);

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.OK,
    message: "User profile updated successfully",
  });
};

/**
 * Update user's membership status in tenant
 * PATCH /admin/tenants/:tenantId/users/:id/membership
 */
export const updateTenantMembership = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: UpdateTenantMembershipRequest = {
    status: req.body.status,
  };

  const result = await tenantUserService.updateMembership(tenantId as string, id as string, data);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Membership updated successfully",
  });
};

/**
 * Remove user from tenant (delete membership, not user)
 * DELETE /admin/tenants/:tenantId/users/:id
 */
export const removeUserFromTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  await tenantUserService.removeUserFromTenant(tenantId as string, id as string);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "User removed from tenant successfully",
  });
};

/**
 * Assign role to user's membership in tenant
 * POST /admin/tenants/:tenantId/users/:id/roles
 */
export const assignTenantUserRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const adminId = req.adminUser?.id;
  const data: AssignTenantUserRoleRequest = {
    role_id: req.body.role_id,
  };

  await tenantUserService.assignRole(tenantId as string, id as string, data, adminId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Role assigned successfully",
  });
};

/**
 * Revoke role from user's membership in tenant
 * DELETE /admin/tenants/:tenantId/users/:id/roles/:roleId
 */
export const revokeTenantUserRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id, roleId } = req.params;
  await tenantUserService.revokeRole(tenantId as string, id as string, roleId as string);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Role revoked successfully",
  });
};

/**
 * List tenants a user belongs to
 * GET /admin/users/:userId/tenants
 */
export const listUserTenants = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { userId } = req.params;
  const params: UserTenantsQueryParams = {
    status: req.query.status as StaffMembershipStatus | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantUserService.listUserTenants(userId as string, params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "User tenants retrieved successfully",
  });
};

/**
 * Get global user by ID (for admin purposes)
 * GET /admin/users/:userId
 */
export const getGlobalUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { userId } = req.params;
  const user = await tenantUserService.getGlobalUserById(userId as string);

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.OK,
    message: "User retrieved successfully",
  });
};

/**
 * List all staff members globally
 * GET /admin/staff-members
 */
export const listAllStaffMembers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: TenantUserStatus | undefined = req.query.status as TenantUserStatus | undefined;
  const result = await tenantUserService.listAllStaffMembers({
    search: req.query.search as string | undefined,
    status: params,
    tenant_id: req.query.tenant_id as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff members retrieved successfully",
  });
};

/**
 * Get staff member details (with memberships and roles)
 * GET /admin/staff-members/:userId
 */
export const getStaffMemberDetails = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { userId } = req.params;
  const user = await tenantUserService.getGlobalStaffMemberDetails(userId as string);

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff member details retrieved successfully",
  });
};

/**
 * Update a staff member's global profile (email/phone)
 * PATCH /admin/staff-members/:userId
 */
export const updateStaffMemberProfile = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { userId } = req.params;
  const user = await tenantUserService.updateStaffMemberProfile(
    userId as string,
    req.body
  );

  sendSuccessResponse({
    res,
    data: user,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff member updated successfully",
  });
};

/**
 * Export all staff members as Excel
 * GET /admin/staff-members/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export const exportAllStaffMembers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const startDate = req.query.start_date
    ? new Date(req.query.start_date as string)
    : undefined;
  const endDate = req.query.end_date
    ? new Date((req.query.end_date as string) + "T23:59:59.999Z")
    : undefined;

  const buffer = await tenantUserService.exportAllStaffMembers(startDate, endDate);
  const filename = `staff-members-${new Date().toISOString().split("T")[0]}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};

/**
 * Export staff members for a specific tenant as Excel
 * GET /admin/tenants/:tenantId/users/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export const exportTenantStaffMembers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const startDate = req.query.start_date
    ? new Date(req.query.start_date as string)
    : undefined;
  const endDate = req.query.end_date
    ? new Date((req.query.end_date as string) + "T23:59:59.999Z")
    : undefined;

  const buffer = await tenantUserService.exportTenantStaffMembers(tenantId as string, startDate, endDate);
  const filename = `tenant-staff-members-${new Date().toISOString().split("T")[0]}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};


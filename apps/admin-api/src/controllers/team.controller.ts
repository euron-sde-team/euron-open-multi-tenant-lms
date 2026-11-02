import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import teamService from "../services/team.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const listRoles = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const roles = await teamService.listRoles(tenantId);
  sendSuccessResponse({
    res,
    data: roles,
    statusCode: HttpSuccessStatus.OK,
    message: "Roles retrieved successfully",
  });
};

export const getRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const role = await teamService.getRole(getTenantId(req), roleId);
  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Role retrieved successfully",
  });
};

export const createRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  // `code` is deliberately not read from the body, it's an internal identifier
  // the service derives from the name. A client that still sends one is ignored.
  const { name, description } = req.body;
  const role = await teamService.createRole(getTenantId(req), {
    name,
    description,
  });
  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Role created successfully",
  });
};

export const updateRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const { name, description } = req.body;
  const role = await teamService.updateRole(getTenantId(req), roleId, { name, description });
  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Role updated successfully",
  });
};

export const deleteRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  await teamService.deleteRole(getTenantId(req), roleId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Role deleted successfully",
  });
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const listPermissions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const permissions = await teamService.listPermissions();
  sendSuccessResponse({
    res,
    data: permissions,
    statusCode: HttpSuccessStatus.OK,
    message: "Permissions retrieved successfully",
  });
};

// ---------------------------------------------------------------------------
// Role permissions
// ---------------------------------------------------------------------------

export const updateRolePermissions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const { permissionIds } = req.body;

  if (!Array.isArray(permissionIds)) {
    throw new BadRequestError("permissionIds must be an array");
  }

  await teamService.updateRolePermissions(getTenantId(req), roleId, permissionIds);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Role permissions updated successfully",
  });
};

// ---------------------------------------------------------------------------
// Email Check
// ---------------------------------------------------------------------------

export const checkEmail = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const email = (req.query.email as string) ?? "";

  if (!email || !email.includes("@")) {
    throw new BadRequestError("A valid email is required");
  }

  const result = await teamService.checkEmail(tenantId, email);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Email check completed",
  });
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const listStaff = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const staff = await teamService.listStaff(tenantId);
  sendSuccessResponse({
    res,
    data: staff,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff retrieved successfully",
  });
};

export const assignStaffRoles = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const userId = param(req, "userId");
  const { roleIds } = req.body;

  if (!Array.isArray(roleIds)) {
    throw new BadRequestError("roleIds must be an array");
  }

  await teamService.assignRoles(
    tenantId,
    userId,
    roleIds,
    req.tenantUser.id
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff roles assigned successfully",
  });
};

export const removeStaffRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const userId = param(req, "userId");
  const roleId = param(req, "roleId");

  await teamService.removeRole(tenantId, userId, roleId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Staff role removed successfully",
  });
};

// ---------------------------------------------------------------------------
// Team member management
// ---------------------------------------------------------------------------

export const inviteMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { email, name, roleIds } = req.body;
  const result = await teamService.inviteMember(
    tenantId,
    { email, name, roleIds },
    req.tenantUser.id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Team member invited successfully",
  });
};

export const resetMemberPassword = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const userId = param(req, "userId");
  const result = await teamService.resetMemberPassword(
    tenantId,
    userId,
    req.tenantUser.id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Password reset successfully",
  });
};

export const removeMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const userId = param(req, "userId");
  await teamService.removeMember(tenantId, userId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Team member removed successfully",
  });
};

// ---------------------------------------------------------------------------
// Capabilities, the plain-English layer the role editor uses.
//
// The admin ticks sentences ("Can create and publish courses"); the service
// translates them into the permission codes the engine enforces. Raw codes are
// still available via the /permissions endpoints for the Advanced view.
// ---------------------------------------------------------------------------

export const listCapabilities = async (
  _req: Request,
  res: Response<IResponseFormat>
) => {
  sendSuccessResponse({
    res,
    data: teamService.getCapabilities(),
    statusCode: HttpSuccessStatus.OK,
    message: "Capabilities retrieved successfully",
  });
};

export const getRoleCapabilities = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const result = await teamService.getRoleCapabilities(
    getTenantId(req),
    roleId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Role capabilities retrieved successfully",
  });
};

export const updateRoleCapabilities = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const { capabilityIds } = req.body ?? {};

  if (!Array.isArray(capabilityIds)) {
    throw new BadRequestError("capabilityIds must be an array");
  }

  await teamService.setRoleCapabilities(
    getTenantId(req),
    roleId,
    capabilityIds
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Role updated successfully",
  });
};

export const duplicateRole = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const roleId = param(req, "roleId");
  const { name } = req.body ?? {};
  const role = await teamService.duplicateRole(getTenantId(req), roleId, {
    name,
  });
  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Role duplicated successfully",
  });
};

/**
 * Switch a teammate's access off, or back on.
 *
 * Deleting someone throws away their roles and their history. Suspending keeps
 * both, the person on leave, under investigation, or serving notice simply
 * can't sign in until you reactivate them.
 */
export const suspendMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  await teamService.setMemberSuspended(
    getTenantId(req),
    param(req, "userId"),
    true
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Team member suspended",
  });
};

export const reactivateMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  await teamService.setMemberSuspended(
    getTenantId(req),
    param(req, "userId"),
    false
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Team member reactivated",
  });
};

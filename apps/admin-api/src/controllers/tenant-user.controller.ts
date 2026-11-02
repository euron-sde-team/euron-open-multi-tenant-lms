import { Request, Response } from "express";
import tenantUserService from "../services/tenant-user.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get Profile - Get current user profile with tenant memberships
 */
export const getProfile = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;

  const result = await tenantUserService.getProfile(userId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Profile retrieved successfully",
  });
};

/**
 * Update Profile - Update current user profile
 */
export const updateProfile = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;
  const { name, avatar_url } = req.body;

  const result = await tenantUserService.updateProfile(userId, {
    name,
    avatar_url,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Profile updated successfully",
  });
};

/**
 * Get Tenants - Get all tenants the user belongs to
 */
export const getTenants = async (req: Request, res: Response<IResponseFormat>) => {
  const userId = req.tenantUser.id;

  const result = await tenantUserService.getUserTenants(userId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenants retrieved successfully",
  });
};


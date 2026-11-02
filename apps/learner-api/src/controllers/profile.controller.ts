import { Request, Response } from "express";
import profileService from "../services/profile.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const getPublicProfile = async (
  req: Request,
  res: Response<IResponseFormat>,

  _next: () => void
): Promise<void> => {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const userId = String(req.params.userId);
  if (!userId) throw new BadRequestError("User ID required");
  const result = await profileService.getPublicProfile(tenantId, userId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Public profile retrieved",
  });
};

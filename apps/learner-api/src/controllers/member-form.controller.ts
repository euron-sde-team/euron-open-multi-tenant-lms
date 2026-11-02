import { Request, Response } from "express";

import memberFormService from "../services/member-form.service";
import { sendSuccessResponse, HttpSuccessStatus } from "../utils/response.util";

export const getMemberForm = async (req: Request, res: Response) => {
  const tenantId = req.tenant!.id;
  const memberId = req.user!.id;

  const result = await memberFormService.getFormsForMember(tenantId, memberId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Member forms retrieved",
  });
};

export const submitMemberForm = async (req: Request, res: Response) => {
  const tenantId = req.tenant!.id;
  const memberId = req.user!.id;
  const { formId, data } = (req.body ?? {}) as {
    formId?: unknown;
    data?: unknown;
  };

  await memberFormService.submitResponse(tenantId, formId, memberId, data);

  sendSuccessResponse({
    res,
    data: { completed: true },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Response saved",
  });
};

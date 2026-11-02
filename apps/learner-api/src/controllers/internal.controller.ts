import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import testRewardsService from "../services/test-rewards.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Issue rewards (certificate + scholarships) for a graded attempt. Pinged by
 * tenant-admin the moment an evaluator finishes marking a descriptive attempt,
 * so the certificate is issued and emailed without the learner reopening their
 * result. Idempotent and no-ops for attempts that are not yet COMPLETED.
 */
export const issueTestRewards = async (req: Request, res: Response) => {
  const attemptId = String(req.params.attemptId ?? "").trim();
  const tenantId = String(req.body?.tenantId ?? "").trim();
  if (!attemptId || !tenantId) {
    throw new BadRequestError("attemptId and tenantId are required");
  }

  const result = await testRewardsService.issueForAttempt(tenantId, attemptId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Reward issuance processed",
  });
};

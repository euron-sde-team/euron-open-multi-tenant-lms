import { Router } from "express";
import {
  listQuestionBanks,
  getQuestionBank,
  createQuestionBank,
  updateQuestionBank,
  deleteQuestionBank,
} from "../controllers/test-question-banks.controller";
import { getQuestionHealth } from "../controllers/test-health.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testQuestionBanksRouter: Router = Router();

testQuestionBanksRouter.use(asyncHandler(authenticateTenantUser));

testQuestionBanksRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listQuestionBanks)
);
testQuestionBanksRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createQuestionBank)
);
testQuestionBanksRouter.get(
  "/:bankId",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getQuestionBank)
);
testQuestionBanksRouter.get(
  "/:bankId/question-health",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getQuestionHealth)
);
testQuestionBanksRouter.put(
  "/:bankId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateQuestionBank)
);
testQuestionBanksRouter.delete(
  "/:bankId",
  asyncHandler(requirePermission("tests.delete")),
  asyncHandler(deleteQuestionBank)
);

export default testQuestionBanksRouter;

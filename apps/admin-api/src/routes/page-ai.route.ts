import { Router } from "express";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { generateSection, planPage, getPagePlanStatus, generateImage, getImageGenerationStatus } from "../controllers/page-ai.controller";
import { asyncHandler } from "../utils/asynchandler";

const pageAIRouter: Router = Router();

pageAIRouter.use(asyncHandler(authenticateTenantUser));
pageAIRouter.use(asyncHandler(requireAiAuthoring));

pageAIRouter.post("/plan-page", asyncHandler(requirePermission("ai.content_gen.use")), asyncHandler(planPage));
pageAIRouter.get("/plan-status/:jobId", asyncHandler(requirePermission("ai.content_gen.use")), asyncHandler(getPagePlanStatus));
pageAIRouter.post("/generate-section", asyncHandler(requirePermission("ai.content_gen.use")), asyncHandler(generateSection));
pageAIRouter.post("/generate-image", asyncHandler(requirePermission("ai.content_gen.use")), asyncHandler(generateImage));
pageAIRouter.get("/image-status/:jobId", asyncHandler(requirePermission("ai.content_gen.use")), asyncHandler(getImageGenerationStatus));

export default pageAIRouter;

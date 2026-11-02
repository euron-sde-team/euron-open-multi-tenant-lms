import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { getAnalytics } from "../controllers/member-analytics.controller";

const router: Router = Router();

router.get("/", asyncHandler(getAnalytics));

export default router;

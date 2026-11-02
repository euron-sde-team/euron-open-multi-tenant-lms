import { Router } from "express";

import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser } from "../middlewares/auth.middleware";
import {
  getDashboard,
  calculateScore,
} from "../controllers/test-performance.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateUser));

router.get("/dashboard", asyncHandler(getDashboard));
router.post("/score-calculator", asyncHandler(calculateScore));

export default router;

import { Router } from "express";

import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser } from "../middlewares/auth.middleware";
import {
  getTestLeaderboard,
  getStreak,
} from "../controllers/engagement.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateUser));

router.get("/leaderboard/test/:testId", asyncHandler(getTestLeaderboard));
router.get("/streak", asyncHandler(getStreak));

export default router;

import type { IRouter } from "express";
import { Router } from "express";
import { getPublicProfile } from "../controllers/profile.controller";
import { asyncHandler } from "../utils/asynchandler";

const profileRouter: IRouter = Router();

profileRouter.get("/public/:userId", asyncHandler(getPublicProfile));

export default profileRouter;

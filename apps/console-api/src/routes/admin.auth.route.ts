import { Router } from "express";
import { login, logout, me } from "../controllers/admin.auth.controller";
import { authenticateAdmin } from "../middlewares/admin.auth.middleware";
import { loginRateLimit } from "../middlewares/rate-limit.middleware";
import { asyncHandler } from "../utils/asynchandler";

const adminAuthRouter: Router = Router();

// Public routes (rate limited per IP and per email)
adminAuthRouter.post("/login", asyncHandler(loginRateLimit), asyncHandler(login));

// Protected routes (require authentication)
adminAuthRouter.get("/me", asyncHandler(authenticateAdmin), asyncHandler(me));
adminAuthRouter.post("/logout", asyncHandler(authenticateAdmin), asyncHandler(logout));

export default adminAuthRouter;

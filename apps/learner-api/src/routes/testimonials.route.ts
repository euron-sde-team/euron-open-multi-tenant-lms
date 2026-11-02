import { Router } from "express";
import * as testimonialController from "../controllers/testimonials.controller";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testimonialRouter: Router = Router();

// Public (optionalAuth not strictly needed but consistent with pattern)
testimonialRouter.get(
  "/",
  asyncHandler(optionalAuth),
  asyncHandler(testimonialController.listTestimonials)
);

// Auth required
testimonialRouter.post(
  "/",
  asyncHandler(authenticateUser),
  asyncHandler(testimonialController.submitTestimonial)
);

export default testimonialRouter;

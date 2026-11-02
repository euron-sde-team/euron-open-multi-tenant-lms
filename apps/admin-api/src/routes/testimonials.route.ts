import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  listTestimonials,
  getTestimonialStats,
  getTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  updateTestimonialStatus,
} from "../controllers/testimonials.controller";

const testimonialsRouter: Router = Router();

testimonialsRouter.use(asyncHandler(authenticateTenantUser));

testimonialsRouter.get("/", asyncHandler(requirePermission("testimonials.view")), asyncHandler(listTestimonials));
testimonialsRouter.get("/stats", asyncHandler(requirePermission("testimonials.view")), asyncHandler(getTestimonialStats));
testimonialsRouter.get("/:id", asyncHandler(requirePermission("testimonials.view")), asyncHandler(getTestimonial));
testimonialsRouter.post("/", asyncHandler(requirePermission("testimonials.moderate")), asyncHandler(createTestimonial));
testimonialsRouter.put("/:id", asyncHandler(requirePermission("testimonials.moderate")), asyncHandler(updateTestimonial));
testimonialsRouter.delete("/:id", asyncHandler(requirePermission("testimonials.moderate")), asyncHandler(deleteTestimonial));
testimonialsRouter.patch("/:id/status", asyncHandler(requirePermission("testimonials.moderate")), asyncHandler(updateTestimonialStatus));

export default testimonialsRouter;

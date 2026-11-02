/**
 * Public instructor routes, read-only endpoints for end users.
 * Tenant resolution happens at the v1 router level.
 */

import { Router } from "express";
import { listInstructors, getInstructorDetail, getCourseInstructors } from "../controllers/instructor.controller";
import { asyncHandler } from "../utils/asynchandler";

const instructorRouter: Router = Router();

// GET /instructors/course/:courseId, instructors assigned to a course (with socials)
instructorRouter.get("/course/:courseId", asyncHandler(getCourseInstructors));

// GET /instructors, paginated list
instructorRouter.get("/", asyncHandler(listInstructors));

// GET /instructors/:id, detail with experiences, socials, courses, books
instructorRouter.get("/:id", asyncHandler(getInstructorDetail));

export default instructorRouter;

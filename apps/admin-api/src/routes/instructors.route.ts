import { Router } from "express";
import multer from "multer";
import {
  listInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadCompanyLogo,
  deleteCompanyLogo,
  listExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  getSocials,
  upsertSocials,
} from "../controllers/instructors.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_TYPES.includes(file.mimetype));
  },
});

const instructorsRouter: Router = Router();

instructorsRouter.use(asyncHandler(authenticateTenantUser));

// Instructor CRUD
instructorsRouter.get("/", asyncHandler(requirePermission("instructors.view")), asyncHandler(listInstructors));
instructorsRouter.post("/", asyncHandler(requirePermission("instructors.create")), asyncHandler(createInstructor));
instructorsRouter.get("/:instructorId", asyncHandler(requirePermission("instructors.view")), asyncHandler(getInstructor));
instructorsRouter.put("/:instructorId", asyncHandler(requirePermission("instructors.update")), asyncHandler(updateInstructor));
instructorsRouter.delete("/:instructorId", asyncHandler(requirePermission("instructors.delete")), asyncHandler(deleteInstructor));

// Profile photo upload/delete
instructorsRouter.post("/:instructorId/photo", asyncHandler(requirePermission("instructors.update")), upload.single("file"), asyncHandler(uploadProfilePhoto));
instructorsRouter.delete("/:instructorId/photo", asyncHandler(requirePermission("instructors.update")), asyncHandler(deleteProfilePhoto));

// Experiences (nested under instructor)
instructorsRouter.get("/:instructorId/experiences", asyncHandler(requirePermission("instructors.view")), asyncHandler(listExperiences));
instructorsRouter.post("/:instructorId/experiences", asyncHandler(requirePermission("instructors.update")), asyncHandler(createExperience));
instructorsRouter.put("/:instructorId/experiences/:experienceId", asyncHandler(requirePermission("instructors.update")), asyncHandler(updateExperience));
instructorsRouter.delete("/:instructorId/experiences/:experienceId", asyncHandler(requirePermission("instructors.update")), asyncHandler(deleteExperience));

// Company logo upload/delete (nested under experience)
instructorsRouter.post("/:instructorId/experiences/:experienceId/logo", asyncHandler(requirePermission("instructors.update")), upload.single("file"), asyncHandler(uploadCompanyLogo));
instructorsRouter.delete("/:instructorId/experiences/:experienceId/logo", asyncHandler(requirePermission("instructors.update")), asyncHandler(deleteCompanyLogo));

// Socials (1:1, nested under instructor)
instructorsRouter.get("/:instructorId/socials", asyncHandler(requirePermission("instructors.view")), asyncHandler(getSocials));
instructorsRouter.put("/:instructorId/socials", asyncHandler(requirePermission("instructors.update")), asyncHandler(upsertSocials));

export default instructorsRouter;

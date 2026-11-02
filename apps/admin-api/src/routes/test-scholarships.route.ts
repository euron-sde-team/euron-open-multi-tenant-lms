import { Router } from "express";

import {
  listScholarships,
  createScholarship,
  updateScholarship,
  deleteScholarship,
  listScholarshipAwards,
  decideScholarshipAward,
} from "../controllers/test-scholarships.controller";
import { decideAwards } from "../controllers/exam-workflows.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testScholarshipsRouter: Router = Router();

testScholarshipsRouter.use(asyncHandler(authenticateTenantUser));

testScholarshipsRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listScholarships)
);
testScholarshipsRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createScholarship)
);
testScholarshipsRouter.get(
  "/awards",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listScholarshipAwards)
);
// Awards are read as a batch and decided as a batch ("confirm the top ten").
testScholarshipsRouter.post(
  "/awards/decide",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(decideAwards)
);
testScholarshipsRouter.patch(
  "/awards/:awardId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(decideScholarshipAward)
);
testScholarshipsRouter.put(
  "/:scholarshipId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateScholarship)
);
testScholarshipsRouter.delete(
  "/:scholarshipId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(deleteScholarship)
);

export default testScholarshipsRouter;

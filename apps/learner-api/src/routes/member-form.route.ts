import { Router } from "express";

import {
  getMemberForm,
  submitMemberForm,
} from "../controllers/member-form.controller";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

router.get("/", asyncHandler(getMemberForm));
router.post("/responses", asyncHandler(submitMemberForm));

export default router;

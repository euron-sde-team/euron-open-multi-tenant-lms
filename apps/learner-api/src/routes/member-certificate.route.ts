import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { getMyCertificates } from "../controllers/member-certificate.controller";

const router: Router = Router();

router.get("/", asyncHandler(getMyCertificates));

export default router;

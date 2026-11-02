import { Router } from "express";
import {
  listCertificateAssignments,
  setCertificateAssignment,
  clearCertificateAssignment,
} from "../controllers/certificate-assignments.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const certificateAssignmentsRouter: Router = Router();

const canView = asyncHandler(requirePermission("certificates.view"));
const canManage = asyncHandler(requirePermission("certificates.manage"));

certificateAssignmentsRouter.use(asyncHandler(authenticateTenantUser));

certificateAssignmentsRouter.get("/", canView, asyncHandler(listCertificateAssignments));
certificateAssignmentsRouter.put("/:offeringType", asyncHandler(requirePermission("certificates.manage")), canManage, asyncHandler(setCertificateAssignment));
certificateAssignmentsRouter.delete("/:offeringType", asyncHandler(requirePermission("certificates.manage")), canManage, asyncHandler(clearCertificateAssignment));

export default certificateAssignmentsRouter;

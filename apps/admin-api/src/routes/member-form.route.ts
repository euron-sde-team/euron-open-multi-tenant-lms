import { Router } from "express";

import {
  listMemberForms,
  getMemberForm,
  createMemberForm,
  updateMemberForm,
  deleteMemberForm,
  reorderMemberForms,
  listMemberFormResponses,
  getMemberFormResponse,
  listMemberResponsesForMember,
} from "../controllers/member-form.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const memberFormRouter: Router = Router();

memberFormRouter.use(asyncHandler(authenticateTenantUser));

// Collection + literal routes first so they are not captured by "/:formId".
memberFormRouter.get(
  "/",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(listMemberForms)
);
memberFormRouter.post(
  "/",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(createMemberForm)
);
memberFormRouter.put(
  "/reorder",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(reorderMemberForms)
);
// All of a single member's responses, across every form (user detail tab).
memberFormRouter.get(
  "/responses/member/:memberId",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(listMemberResponsesForMember)
);

// Per-form routes.
memberFormRouter.get(
  "/:formId/responses/:memberId",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberFormResponse)
);
memberFormRouter.get(
  "/:formId/responses",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(listMemberFormResponses)
);
memberFormRouter.get(
  "/:formId",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberForm)
);
memberFormRouter.put(
  "/:formId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(updateMemberForm)
);
memberFormRouter.delete(
  "/:formId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(deleteMemberForm)
);

export default memberFormRouter;

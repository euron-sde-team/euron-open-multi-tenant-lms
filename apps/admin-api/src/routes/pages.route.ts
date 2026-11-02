import { Router } from "express";
import {
  createPage,
  deletePage,
  duplicatePage,
  getPageById,
  getPageBySlug,
  getPages,
  getTenantHomepage,
  togglePublish,
  getPageRevisions,
  restorePageRevision,
  updatePage,
  listSectionTypes,
  listPageTemplates,
  applyPageTemplate,
  applySitePalette,
  listSitePalettes,
  restoreSiteTheme,
  removePageSection,
  insertPageSection,
} from "../controllers/pages.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const pagesRouter: Router = Router();

// Public routes (no authentication required - for web app rendering)
// GET /pages/tenant/:tenantId/slug/:slug - Get published page by tenant and slug
pagesRouter.get(
  "/tenant/:tenantId/slug/:slug",
  asyncHandler(getPageBySlug)
);

// GET /pages/section-types - the vocabulary a page can be built from.
// Above "/:id" deliberately: Express matches top-to-bottom and would otherwise
// read "section-types" as a page id.
pagesRouter.get(
  "/section-types",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(listSectionTypes)
);

// Both template routes must sit ABOVE "/:id" or Express reads "templates" as a
// page id, the same trap the section-types route documents.
pagesRouter.get(
  "/templates",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(listPageTemplates)
);
pagesRouter.post(
  "/templates/apply",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(applyPageTemplate)
);

// Colours only. Sits with the template routes and above "/:id" for the same
// reason: Express would otherwise read "palettes" as a page id.
pagesRouter.get(
  "/palettes",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(listSitePalettes)
);
pagesRouter.post(
  "/templates/apply-theme",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(applySitePalette)
);
pagesRouter.post(
  "/templates/restore-theme",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(restoreSiteTheme)
);

// Protected routes (authentication required - for admin app)
// GET /pages?tenantId=:tenantId&page=1&limit=20 - List pages for tenant
pagesRouter.get(
  "/",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(getPages)
);

// GET /pages/homepage - Get the tenant's homepage (any publish status)
// MUST stay above "/:id": both are single-segment, so Express matches whichever
// is declared first and "/:id" would otherwise swallow "homepage" as an id.
pagesRouter.get(
  "/homepage",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(getTenantHomepage)
);

// GET /pages/:id - Get page by ID
pagesRouter.get(
  "/:id",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(getPageById)
);

// POST /pages - Create a new page
pagesRouter.post(
  "/",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.create")),
  asyncHandler(createPage)
);

// PUT /pages/:id - Update a page
pagesRouter.put(
  "/:id",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(updatePage)
);

// DELETE /pages/:id - Delete a page
pagesRouter.delete(
  "/:id",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.delete")),
  asyncHandler(deletePage)
);

// POST /pages/:id/publish - Toggle publish status (using POST for better CORS compatibility)
pagesRouter.post(
  "/:id/publish",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.publish")),
  asyncHandler(togglePublish)
);

// PATCH /pages/:id/publish - Toggle publish status (kept for backward compatibility)
pagesRouter.patch(
  "/:id/publish",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.publish")),
  asyncHandler(togglePublish)
);

// GET /pages/:id/revisions - list saved versions of a custom-code page
pagesRouter.get(
  "/:id/revisions",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(getPageRevisions)
);

// POST /pages/:id/revisions/:revisionId/restore - restore a version into the draft
pagesRouter.post(
  "/:id/revisions/:revisionId/restore",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(restorePageRevision)
);

// POST /pages/:id/sections/remove - remove ONE section, matched server-side.
// A route rather than a PUT-the-array because "remove the section headed X"
// is a read-modify-write a pre-written plan cannot express.
pagesRouter.post(
  "/:id/sections/remove",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(removePageSection)
);

// POST /pages/:id/sections/insert - the inverse, so removal is undoable.
pagesRouter.post(
  "/:id/sections/insert",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(insertPageSection)
);

// POST /pages/:id/duplicate - Duplicate a page
pagesRouter.post(
  "/:id/duplicate",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("pages.create")),
  asyncHandler(duplicatePage)
);

export default pagesRouter;

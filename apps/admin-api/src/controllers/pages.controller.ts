import { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { SECTION_TYPES } from "../lib/section-catalogue";
import pageTemplateService from "../services/page-template.service";
import pagesService from "../services/pages.service";
import { IResponseFormat } from "../types/response.type";
import logger from "../utils/logger";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get all pages for a tenant
 * GET /pages?tenantId=:tenantId&page=1&limit=20
 * Uses req.tenantId when present; query.tenantId must match if both provided.
 */
export const getPages = async (req: Request, res: Response<IResponseFormat>) => {
  const queryTenantId = req.query.tenantId as string | undefined;
  const tenantId = req.tenantId ?? queryTenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  if (req.tenantId != null && queryTenantId != null && req.tenantId !== queryTenantId) {
    throw new ForbiddenError("Tenant mismatch");
  }
  const { page, limit } = req.query;

  const result = await pagesService.getPages(
    tenantId,
    page ? parseInt(page as string, 10) : 1,
    limit ? parseInt(limit as string, 10) : 20
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Pages retrieved successfully",
  });
};

/**
 * The section types a page can be built from.
 * GET /pages/section-types
 *
 * Exists so the assistant can BUILD pages rather than only edit the words in
 * sections that already exist: it was told never to invent a section type and
 * never told which ones are real.
 */
/**
 * The page-template library: whole looks, not individual sections.
 * GET /pages/templates
 *
 * `listSectionTypes` answers "what pieces can I build with". This answers "what
 * finished designs exist", which is the question a tenant actually asks when
 * they say their site looks wrong. Choosing a template used to be possible only
 * by clicking in the editor.
 */
export const listPageTemplates = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");

  const templateId = req.query.templateId as string | undefined;
  const search = req.query.search as string | undefined;

  sendSuccessResponse({
    res,
    data: pageTemplateService.listTemplates(templateId, search),
    statusCode: HttpSuccessStatus.OK,
    message: "Page templates retrieved successfully",
  });
};

/**
 * Apply a template to a page, by default the homepage.
 * POST /pages/templates/apply
 *
 * REPLACES the page's sections, and optionally the theme. On the homepage that
 * re-themes the whole site, because the web app reads the homepage's theme as
 * the global one. The previous sections come back in the response so the change
 * can be undone; nothing else keeps a section-level snapshot.
 *
 * `dryRun: true` reports what would change and writes nothing, which is the
 * honest way to answer "what would this template look like".
 */
export const applyPageTemplate = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  const { templateId, themeId, pageId, dryRun, confirmReplace } = req.body ?? {};

  if (!templateId || typeof templateId !== "string") {
    throw new BadRequestError("templateId is required");
  }

  const result = await pageTemplateService.applyTemplate({
    tenantId: req.tenantId,
    templateId,
    themeId: typeof themeId === "string" && themeId ? themeId : undefined,
    pageId: typeof pageId === "string" && pageId ? pageId : undefined,
    dryRun: dryRun === true,
    confirmReplace: confirmReplace === true,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: result.dryRun
      ? `"${result.templateName}" would replace ${result.sectionsBefore} sections with ${result.sectionsAfter}. Nothing was changed.`
      : `Applied "${result.templateName}" to ${result.pageSlug}.`,
  });
};

export const listSectionTypes = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  const category = req.query.category as string | undefined;
  const types = category
    ? SECTION_TYPES.filter((s) => s.category === category)
    : SECTION_TYPES;

  sendSuccessResponse({
    res,
    data: { total: types.length, sections: types },
    statusCode: HttpSuccessStatus.OK,
    message: "Section types retrieved successfully",
  });
};

/**
 * Get a page by ID
 * GET /pages/:id
 */
export const getPageById = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  const result = await pagesService.getPageById(id as string, tenantId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Page retrieved successfully",
  });
};

/**
 * Get a page by tenant ID and slug (public - for web app rendering)
 * GET /pages/tenant/:tenantId/slug/:slug
 */
export const getPageBySlug = async (req: Request, res: Response<IResponseFormat>) => {
  const { tenantId, slug } = req.params;

  // Use published page for public access
  const result = await pagesService.getPublishedPageBySlug(tenantId as string, slug as string);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Page retrieved successfully",
  });
};

/**
 * Get the authenticated tenant's homepage, regardless of publish status
 * GET /pages/homepage?tenantId=:tenantId
 *
 * Point read for the site-wide theme and layout. Replaces paging the list and
 * scanning it for the homepage, which silently missed the row once a tenant
 * owned more pages than the list limit returns. Responds with null data when
 * the tenant has no homepage yet.
 *
 * Tenant resolution mirrors getPages: req.tenantId wins, query must match if both given.
 */
export const getTenantHomepage = async (req: Request, res: Response<IResponseFormat>) => {
  const queryTenantId = req.query.tenantId as string | undefined;
  const tenantId = req.tenantId ?? queryTenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  if (req.tenantId != null && queryTenantId != null && req.tenantId !== queryTenantId) {
    throw new ForbiddenError("Tenant mismatch");
  }

  const result = await pagesService.getHomepage(tenantId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Homepage retrieved successfully",
  });
};

/**
 * Create a new page
 * POST /pages
 * Uses req.tenantId only; body.tenantId must match if provided.
 */
export const createPage = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  const bodyTenantId = req.body?.tenantId;
  if (bodyTenantId != null && bodyTenantId !== tenantId) {
    throw new ForbiddenError("Tenant mismatch");
  }
  const { slug, title, sections, theme, seo, isPublished, renderMode, customCodeKind, customHtmlDraft, customAssets } = req.body;
  const userId = req.tenantUser?.id;

  logger.info(`Page create request - tenantId: ${tenantId}, userId: ${userId}, slug: ${slug}, title: ${title}`);

  try {
    const result = await pagesService.createPage({
      tenantId,
      slug,
      title,
      sections,
      theme,
      seo,
      isPublished,
      userId,
      renderMode,
      customCodeKind,
      customHtmlDraft,
      customAssets,
    });

    logger.info(`Page created successfully - pageId: ${result.id}`);

    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.CREATED,
      message: "Page created successfully",
    });
  } catch (error) {
    logger.error(`Page create failed - tenantId: ${tenantId}, error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

/**
 * Update a page
 * PUT /pages/:id
 */
export const updatePage = async (req: Request, res: Response<IResponseFormat>) => {
  const startTime = Date.now();
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  const { slug, title, sections, theme, seo, isPublished, renderMode, customCodeKind, customHtmlDraft, customAssets } = req.body;
  const userId = req.tenantUser?.id;

  // Calculate payload size for debugging
  const payloadSize = JSON.stringify(req.body).length;

  // Log the update attempt for debugging
  logger.info(`Page update request - pageId: ${id}, userId: ${userId}, slug: ${slug}, title: ${title}, sectionsCount: ${sections?.length || 0}, payloadSize: ${payloadSize} bytes`);

  // SECTION-LOSS GUARD, for agent-originated updates only.
  //
  // `sections` REPLACES the array. A person deleting sections in the editor
  // means it; a model that read a page, changed one headline and sent back a
  // one-element array does not, and that silently deleted a live homepage
  // during testing, reporting success, because the update did exactly what it
  // was told. The editor keeps its existing behaviour: this refuses only when
  // the caller is the assistant (X-Agent-Request) AND the update would drop
  // most of the page.
  //
  // Deliberately a REFUSAL rather than a merge: guessing which sections the
  // caller meant to keep would be a different silent wrong answer.
  if (Array.isArray(sections) && req.get("X-Agent-Request") === "1") {
    const existing = await pagesService.getPageById(id as string, tenantId).catch(() => null);
    const before = Array.isArray(existing?.sections) ? existing.sections.length : 0;
    const after = sections.length;
    if (before >= 3 && after < Math.ceil(before / 2)) {
      throw new BadRequestError(
        `This would cut the page from ${before} sections to ${after}. Read the page, change only what was asked, and send every section back, including the ones you are keeping. Nothing was changed.`
      );
    }
  }

  try {
    const serviceStartTime = Date.now();
    const result = await pagesService.updatePage(id as string, tenantId, {
      slug,
      title,
      sections,
      theme,
      seo,
      isPublished,
      userId,
      renderMode,
      customCodeKind,
      customHtmlDraft,
      customAssets,
    });
    const serviceEndTime = Date.now();

    const totalTime = Date.now() - startTime;
    logger.info(`Page updated successfully - pageId: ${id}, serviceTime: ${serviceEndTime - serviceStartTime}ms, totalTime: ${totalTime}ms`);

    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Page updated successfully",
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    // Log detailed error information
    logger.error(`Page update failed - pageId: ${id}, time: ${errorTime}ms, error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Page update error stack: ${error instanceof Error ? error.stack : "No stack trace"}`);

    // Re-throw to let the error handler middleware handle the response
    throw error;
  }
};

/**
 * Delete a page
 * DELETE /pages/:id
 */
export const deletePage = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  await pagesService.deletePage(id as string, tenantId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Page deleted successfully",
  });
};

/**
 * Toggle page publish status
 * PATCH /pages/:id/publish
 */
export const togglePublish = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  const { isPublished } = req.body;

  const result = await pagesService.togglePublish(id as string, tenantId, isPublished);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Page ${isPublished ? "published" : "unpublished"} successfully`,
  });
};

/**
 * List saved versions of a custom-code page.
 * GET /pages/:id/revisions
 */
export const getPageRevisions = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  const result = await pagesService.listRevisions(tenantId, id as string);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Versions fetched" });
};

/**
 * Restore a saved version into the page draft.
 * POST /pages/:id/revisions/:revisionId/restore
 */
export const restorePageRevision = async (req: Request, res: Response<IResponseFormat>) => {
  const { id, revisionId } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  const result = await pagesService.restoreRevision(tenantId, id as string, revisionId as string);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Version restored to draft" });
};

/**
 * Remove ONE section from a page, matched server-side by heading or id.
 * POST /pages/:id/sections/remove
 *
 * Exists because "remove the section headed X" is a read-modify-write no
 * pre-written plan can express, the same reason the menu has /nav routes.
 */
export const removePageSection = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  const { section_id, heading } = (req.body ?? {}) as { section_id?: string; heading?: string };
  const result = await pagesService.removeSection(tenantId, id as string, {
    sectionId: section_id,
    heading,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Removed the "${result.removed.label}" section`,
  });
};

/**
 * Insert ONE section at a position, removeSection's inverse, which is what
 * makes removing a section undoable.
 * POST /pages/:id/sections/insert
 */
export const insertPageSection = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  const { section, index } = (req.body ?? {}) as {
    section?: Record<string, unknown>;
    index?: number;
  };
  if (!section) throw new BadRequestError("section is required");
  const result = await pagesService.insertSection(tenantId, id as string, section, index);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Inserted the "${result.inserted.label}" section`,
  });
};

/**
 * Duplicate a page
 * POST /pages/:id/duplicate
 */
export const duplicatePage = async (req: Request, res: Response<IResponseFormat>) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  const { slug: newSlug } = req.body;

  const result = await pagesService.duplicatePage(id as string, tenantId, newSlug);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Page duplicated successfully",
  });
};

/**
 * The colour palettes on offer, and the one in use.
 *
 * `family` is the brand colour; `darkFamily` is the canvas in dark mode. They
 * are different questions, and "make my dark theme blue" is the second one.
 */
export const listSitePalettes = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  const result = await pageTemplateService.listSitePalettes(req.tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Colour palettes",
  });
};

/**
 * Recolour the whole site without touching a word of its content.
 *
 * Writes the theme the web app renders (the homepage's, which it treats as the
 * global one). The brand-colour fields on the layout record are a different
 * store that nothing on the storefront reads, which is why changing them
 * looked like success and changed nothing.
 */
export const applySitePalette = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  const { paletteId, darkFamily, family, pageId, dryRun } = req.body ?? {};

  const named = typeof paletteId === "string" && paletteId.trim() ? paletteId.trim() : undefined;
  const byDark = typeof darkFamily === "string" && darkFamily.trim() ? darkFamily.trim().toLowerCase() : undefined;
  const byBrand = typeof family === "string" && family.trim() ? family.trim().toLowerCase() : undefined;

  // One of the three. Requiring an id would put the caller back in the position
  // of having to look one up first, which is the two-step dance that left the
  // site unchanged when only the first step happened.
  if (!named && !byDark && !byBrand) {
    throw new BadRequestError(
      "Give paletteId, or darkFamily to recolour dark mode, or family to change the brand colour."
    );
  }

  const result = await pageTemplateService.applyPalette({
    tenantId: req.tenantId,
    ...(named ? { paletteId: named } : {}),
    ...(byDark ? { darkFamily: byDark as never } : {}),
    ...(byBrand ? { family: byBrand as never } : {}),
    pageId: typeof pageId === "string" && pageId ? pageId : undefined,
    dryRun: dryRun === true,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: result.dryRun
      ? `"${result.paletteName}" would recolour the site. Nothing was changed.`
      : `The site now uses ${result.paletteName}.${result.chosenBecause ? ` ${result.chosenBecause}` : ""}`,
  });
};

/**
 * Put back the exact colours a page had before it was recoloured.
 *
 * Separate from applying a palette because it takes a captured theme rather
 * than a catalogue id: the colours being restored may never have been one of
 * the palettes, and one route with two different required fields is a contract
 * nothing can describe honestly.
 */
export const restoreSiteTheme = async (req: Request, res: Response<IResponseFormat>) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  const { restoreTheme, pageId } = req.body ?? {};

  if (typeof restoreTheme !== "object" || restoreTheme === null || Array.isArray(restoreTheme)) {
    throw new BadRequestError("restoreTheme must be the theme object captured before the change.");
  }

  const result = await pageTemplateService.applyPalette({
    tenantId: req.tenantId,
    pageId: typeof pageId === "string" && pageId ? pageId : undefined,
    restoreTheme: restoreTheme as Record<string, unknown>,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Put back the colours ${result.pageSlug} had before.`,
  });
};
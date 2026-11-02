import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import {
  validateQuizAnswers,
  validateTimezone,
} from "../lib/creator-intent/validate";
import organizationService from "../services/organization.service";
import tenantProvisioningService from "../services/tenant-provisioning.service";
import { IResponseFormat } from "../types/response.type";
import logger from "../utils/logger";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Create organization - Create a new tenant for the authenticated user.
 *
 * Two paths:
 * - Bare: { name } → existing simple-create flow (legacy SetupOrganizationCard).
 * - Quiz-driven: { name, quiz_answers, timezone? } → auto-provisioning flow
 *   (picks template/theme, runs the AI model for hero+course copy, seeds 5 pages
 *   and a sample DRAFT course atomically, persists creator_intent_profile).
 */
export const createOrganization = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const userId = req.tenantUser.id;
  const { name, quiz_answers, timezone } = req.body;

  if (quiz_answers !== undefined && quiz_answers !== null) {
    // Strict shape check before handing to provisioning. A stale wizard or
    // malformed client payload would otherwise surface as a 500 inside the
    // intent-mapping code.
    const validatedAnswers = validateQuizAnswers(quiz_answers);
    const validatedTimezone = validateTimezone(timezone);

    const result = await tenantProvisioningService.provisionAcademy(userId, {
      org_name: name,
      quiz_answers: validatedAnswers,
      contact_email: req.tenantUser.email,
      owner_name: req.tenantUser.name ?? req.tenantUser.email,
      timezone: validatedTimezone ?? null,
    });

    const responsePayload = {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      subdomainUrl: result.subdomain_url,
      template_id: result.template_id,
      theme_id: result.theme_id,
      generation_source: result.generation_source,
      quiz_answers: result.quiz_answers,
    };

    // CRITICAL diagnostic: inline-log every field of the response payload
    // because the frontend QuizWizard early-returns to "revealed" (skipping
    // all 5 page-creation phases) when ANY of `id` / `template_id` /
    // `theme_id` is falsy. If a wizard build "finishes at step 2" without
    // creating home/about/contact pages, this line tells us which field
    // was undefined coming out of the controller.
    logger.info(
      `[organization.createOrg] response: id=${responsePayload.id ?? "MISSING"} ` +
        `slug=${responsePayload.slug ?? "MISSING"} ` +
        `template_id=${responsePayload.template_id ?? "MISSING"} ` +
        `theme_id=${responsePayload.theme_id ?? "MISSING"} ` +
        `subdomainUrl=${responsePayload.subdomainUrl ?? "MISSING"} ` +
        `generation_source=${responsePayload.generation_source ?? "MISSING"}`,
    );

    sendSuccessResponse({
      res,
      data: responsePayload,
      statusCode: HttpSuccessStatus.CREATED,
      message: "Academy provisioned successfully",
    });
    return;
  }

  const result = await organizationService.createOrganization(userId, { name });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Organization created successfully",
  });
};

/**
 * Update organization name - Only the owner can rename
 */
export const updateOrganizationName = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const userId = req.tenantUser.id;
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  const { name } = req.body;

  const result = await organizationService.updateOrganizationName(
    tenantId,
    userId,
    name
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Organization name updated successfully",
  });
};

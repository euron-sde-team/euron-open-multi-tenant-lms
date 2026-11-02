/**
 * Job-shaped curriculum endpoints.
 *
 * Thin, like every controller here: pull the request apart, call the service,
 * answer.
 */
import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import curriculumAuthoringService, {
  type LessonType,
} from "../services/curriculum-authoring.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

/* ------------------------------------------------------------------ */
/*  Curriculum                                                         */
/* ------------------------------------------------------------------ */

/** GET /tenant/courses/:courseId/curriculum-outline */
export const getCurriculumOutline = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const outline = await curriculumAuthoringService.getOutline(
    getTenantId(req),
    param(req, "courseId")
  );
  sendSuccessResponse({
    res,
    data: outline,
    statusCode: HttpSuccessStatus.OK,
    message: `${outline.totals.modules} module(s), ${outline.totals.lessons} lesson(s)`,
  });
};

/** POST /tenant/courses/:courseId/curriculum/modules */
export const addCurriculum = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { moduleId, moduleTitle, position, lessons } = (req.body ?? {}) as {
    moduleId?: string;
    moduleTitle?: string;
    position?: number;
    lessons?: Array<{ title: string; type?: LessonType }>;
  };

  if (lessons !== undefined && !Array.isArray(lessons)) {
    throw new BadRequestError("Send `lessons` as a list, each with a title.");
  }

  const result = await curriculumAuthoringService.addToCurriculum(
    getTenantId(req),
    param(req, "courseId"),
    { moduleId, moduleTitle, position, lessons }
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: result.moduleCreated
      ? `Added "${result.moduleTitle}" with ${result.lessons.length} lesson(s)`
      : `Added ${result.lessons.length} lesson(s) to "${result.moduleTitle}"`,
  });
};

/** PATCH /tenant/courses/:courseId/curriculum/items/:itemId */
export const updateCurriculumItem = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { itemType, title, freePreview } = (req.body ?? {}) as {
    itemType?: "MODULE" | "LESSON";
    title?: string;
    freePreview?: boolean;
  };

  if (itemType !== "MODULE" && itemType !== "LESSON") {
    throw new BadRequestError("Say whether you are editing a MODULE or a LESSON.");
  }

  const result = await curriculumAuthoringService.updateItem(
    getTenantId(req),
    param(req, "courseId"),
    param(req, "itemId"),
    { itemType, title, freePreview }
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Updated "${result.title}"`,
  });
};

/** PUT /tenant/courses/:courseId/curriculum/arrange */
export const arrangeCurriculum = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { moduleId, lessonId, toModuleId, toPosition } = (req.body ?? {}) as {
    moduleId?: string;
    lessonId?: string;
    toModuleId?: string;
    toPosition?: number;
  };

  const result = await curriculumAuthoringService.arrange(
    getTenantId(req),
    param(req, "courseId"),
    { moduleId, lessonId, toModuleId, toPosition }
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `"${result.title}" is now ${result.position} of ${result.of}`,
  });
};

/** POST /tenant/courses/:courseId/curriculum/publish-to-page */
export const publishCurriculumToPage = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { dryRun, restoreContent } = (req.body ?? {}) as {
    dryRun?: boolean;
    restoreContent?: Record<string, unknown>;
  };

  const result = await curriculumAuthoringService.publishOutlineToPage(
    getTenantId(req),
    param(req, "courseId"),
    { dryRun: dryRun === true, restoreContent }
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: result.dryRun
      ? `The course page would advertise ${result.lessonsShownAfter} lesson(s) instead of ${result.lessonsShownBefore}. Nothing was changed.`
      : `The course page now advertises ${result.lessonsShownAfter} lesson(s).`,
  });
};

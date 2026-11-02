import { Request, Response } from "express";
import testQuestionsService from "../services/test-questions.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import {
  parseQuestionsDocx,
  generateQuestionsDocxTemplate,
} from "../services/test-question-docx.parser";
import {
  parseQuestionsDocxAI,
  parseQuestionsFileAI,
} from "../services/test-question-docx-ai.parser";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

export const listQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const result = await testQuestionsService.list(tenantId, {
    question_bank_id: req.query.question_bank_id as string | undefined,
    page,
    limit,
    search: req.query.search as string | undefined,
    type: req.query.type as string | undefined,
    difficulty: req.query.difficulty as string | undefined,
    status: req.query.status as string | undefined,
    subject: req.query.subject as string | undefined,
    chapter: req.query.chapter as string | undefined,
    topic: req.query.topic as string | undefined,
    subject_node_id: req.query.subject_node_id as string | undefined,
    chapter_node_id: req.query.chapter_node_id as string | undefined,
    topic_node_id: req.query.topic_node_id as string | undefined,
    created_via: req.query.created_via as string | undefined,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Questions retrieved successfully",
  });
};

export const getQuestionsByIds = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = req.body as { ids?: unknown };
  if (!Array.isArray(body.ids)) {
    throw new BadRequestError("ids must be an array of question IDs");
  }
  const ids = body.ids.filter((x): x is string => typeof x === "string");
  if (ids.length > 500) {
    throw new BadRequestError("At most 500 IDs can be fetched at once");
  }
  const data = await testQuestionsService.getByIds(tenantId, ids);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Questions retrieved successfully",
  });
};

export const getQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  const data = await testQuestionsService.getById(tenantId, questionId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question retrieved successfully",
  });
};

export const createQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const data = await testQuestionsService.create(tenantId, req.body, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Question created successfully",
  });
};

export const bulkCreateQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const items = req.body?.questions;
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("questions array is required");
  }
  if (items.length > 500) {
    throw new BadRequestError("Maximum 500 questions per bulk import");
  }
  const result = await testQuestionsService.bulkCreate(
    tenantId,
    bankId,
    items,
    getActorId(req)
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `Imported ${result.created} of ${items.length} questions`,
  });
};

export const importQuestionsDocx = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const file = (req as Request & { file?: { buffer?: Buffer } }).file;
  if (!file?.buffer) {
    throw new BadRequestError("A .docx file is required (form field 'file').");
  }
  const items = await parseQuestionsDocx(file.buffer);
  const result = await testQuestionsService.bulkCreate(
    tenantId,
    bankId,
    items,
    getActorId(req)
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `Imported ${result.created} of ${items.length} questions from Word`,
  });
};

export const importQuestionsDocxAI = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const file = (req as Request & { file?: { buffer?: Buffer } }).file;
  if (!file?.buffer) {
    throw new BadRequestError("A .docx file is required (form field 'file').");
  }
  const items = await parseQuestionsDocxAI(file.buffer, { tenantId });
  const result = await testQuestionsService.bulkCreate(
    tenantId,
    bankId,
    items,
    getActorId(req)
  );
  void testQuestionsService.autoSeedBankDescriptions(tenantId, bankId);
  sendSuccessResponse({
    res,
    data: { ...result, parsed: items.length },
    statusCode: HttpSuccessStatus.CREATED,
    message: `AI imported ${result.created} of ${items.length} questions from Word`,
  });
};

export const importQuestionsFileAI = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const file = (
    req as Request & {
      file?: { buffer?: Buffer; originalname?: string; mimetype?: string };
    }
  ).file;
  if (!file?.buffer) {
    throw new BadRequestError(
      "A file is required (Word, PDF, Excel or CSV; form field 'file')."
    );
  }
  const items = await parseQuestionsFileAI(file.buffer, {
    tenantId,
    filename: file.originalname,
    mimetype: file.mimetype,
  });
  const result = await testQuestionsService.bulkCreate(
    tenantId,
    bankId,
    items,
    getActorId(req)
  );
  // Auto-populate descriptions for the freshly-imported questions in the
  // background, uploaded questions get AI context by default without blocking
  // the import response (this runs server-side after we reply).
  void testQuestionsService.autoSeedBankDescriptions(tenantId, bankId);
  sendSuccessResponse({
    res,
    data: { ...result, parsed: items.length },
    statusCode: HttpSuccessStatus.CREATED,
    message: `AI imported ${result.created} of ${items.length} questions`,
  });
};

export const seedQuestionDescriptions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = (req.body ?? {}) as {
    question_bank_id?: string;
    limit?: number;
    overwrite?: boolean;
  };
  const result = await testQuestionsService.seedDescriptions(tenantId, {
    questionBankId: body.question_bank_id,
    limit: body.limit,
    overwrite: body.overwrite,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Seeded descriptions for ${result.processed} questions (${result.remaining} remaining)`,
  });
};

export const italicizeQuestionTitles = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = (req.body ?? {}) as {
    question_bank_id?: string;
    limit?: number;
    overwrite?: boolean;
    dry_run?: boolean;
  };
  const result = await testQuestionsService.italicizeTitles(tenantId, {
    questionBankId: body.question_bank_id,
    limit: body.limit,
    overwrite: body.overwrite,
    dryRun: body.dry_run,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: result.dryRun
      ? `Dry run: ${result.italicized}/${result.processed} would be italicized (${result.remaining} remaining)`
      : `Italicized titles in ${result.italicized}/${result.processed} questions (${result.remaining} remaining)`,
  });
};

export const downloadQuestionsDocxTemplate = async (
  _req: Request,
  res: Response
) => {
  const buffer = await generateQuestionsDocxTemplate();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"question-import-template.docx\""
  );
  res.send(buffer);
};

export const randomPickQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = req.body ?? {};
  const result = await testQuestionsService.randomPick(tenantId, {
    question_bank_ids: body.question_bank_ids,
    count: body.count,
    distribution: body.distribution ?? {},
    exclude_question_ids: body.exclude_question_ids,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Picked ${result.questions.length} questions`,
  });
};

export const updateQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  const data = await testQuestionsService.update(tenantId, questionId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question updated successfully",
  });
};

export const deleteQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  await testQuestionsService.delete(tenantId, questionId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Question deleted successfully",
  });
};

export const bulkUpdateStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { questionIds, status } = req.body ?? {};
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new BadRequestError("questionIds array is required");
  }
  if (!status) throw new BadRequestError("status is required");
  const result = await testQuestionsService.bulkUpdateStatus(
    tenantId,
    questionIds,
    status
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Updated ${result.updated} questions`,
  });
};

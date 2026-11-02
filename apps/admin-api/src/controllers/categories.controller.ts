import { Request, Response } from "express";
import categoriesService from "../services/categories.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

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

export const listCategories = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const search = req.query.search as string | undefined;
  const is_active = req.query.is_active !== undefined
    ? req.query.is_active === "true"
    : undefined;
  const parent_id = req.query.parent_id as string | undefined;

  const result = await categoriesService.getCategories(tenantId, {
    page, limit, search, is_active,
    parent_id: parent_id === "null" ? null : parent_id,
  });
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Categories retrieved successfully" });
};

export const getCategory = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const categoryId = param(req, "categoryId");
  const category = await categoriesService.getCategoryById(categoryId, tenantId);
  sendSuccessResponse({ res, data: category, statusCode: HttpSuccessStatus.OK, message: "Category retrieved successfully" });
};

export const createCategory = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { name, slug, description, icon_url, parent_id, sort_order, is_active } = req.body;
  if (!name) throw new BadRequestError("name is required");
  const category = await categoriesService.createCategory(tenantId, {
    name, slug, description, icon_url, parent_id, sort_order, is_active,
  });
  sendSuccessResponse({ res, data: category, statusCode: HttpSuccessStatus.CREATED, message: "Category created successfully" });
};

export const updateCategory = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const categoryId = param(req, "categoryId");
  const { name, slug, description, icon_url, parent_id, sort_order, is_active } = req.body;
  const category = await categoriesService.updateCategory(categoryId, tenantId, {
    name, slug, description, icon_url, parent_id, sort_order, is_active,
  });
  sendSuccessResponse({ res, data: category, statusCode: HttpSuccessStatus.OK, message: "Category updated successfully" });
};

export const deleteCategory = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const categoryId = param(req, "categoryId");
  await categoriesService.deleteCategory(categoryId, tenantId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Category deleted successfully" });
};

import { NextFunction, Request, Response } from "express";
import tenantOfferingsService from "../services/tenant-offerings.service";
import {
  OfferingsBooksQueryParams,
  OfferingsCoursesQueryParams,
} from "../types/tenant-offerings.type";
import { PaginationParams } from "../types/tenant.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

const parsePagination = (req: Request): PaginationParams => ({
  page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
  limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
});

/** GET /admin/tenants/:tenantId/offerings/summary */
export const getOfferingsSummary = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.getSummary(
    req.params.tenantId as string
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Offerings summary retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/courses */
export const listOfferingCourses = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: OfferingsCoursesQueryParams = {
    ...parsePagination(req),
    status: req.query.status as string | undefined,
    course_type: req.query.course_type as string | undefined,
    mode: req.query.mode as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await tenantOfferingsService.listCourses(
    req.params.tenantId as string,
    params
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Courses retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/courses/:courseId */
export const getOfferingCourseDetail = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.getCourseDetail(
    req.params.tenantId as string,
    req.params.courseId as string
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course detail retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/books */
export const listOfferingBooks = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: OfferingsBooksQueryParams = {
    ...parsePagination(req),
    status: req.query.status as string | undefined,
    file_format: req.query.file_format as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await tenantOfferingsService.listBooks(
    req.params.tenantId as string,
    params
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Books retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/books/:bookId */
export const getOfferingBookDetail = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.getBookDetail(
    req.params.tenantId as string,
    req.params.bookId as string
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Book detail retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/bundles */
export const listOfferingBundles = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.listBundles(
    req.params.tenantId as string,
    parsePagination(req)
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundles retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/batches */
export const listOfferingBatches = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.listBatches(
    req.params.tenantId as string,
    parsePagination(req)
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Batches retrieved successfully",
  });
};

/** GET /admin/tenants/:tenantId/offerings/test-series */
export const listOfferingTestSeries = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await tenantOfferingsService.listTestSeries(
    req.params.tenantId as string,
    parsePagination(req)
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Test series retrieved successfully",
  });
};

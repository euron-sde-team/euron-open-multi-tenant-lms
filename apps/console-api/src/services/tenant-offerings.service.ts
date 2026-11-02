import { NotFoundError } from "../errors/not-found.error";
import tenantOfferingsRepository from "../repositories/tenant-offerings.repository";
import tenantRepository from "../repositories/tenant.repository";
import {
  OfferingBatchesListResponse,
  OfferingBookDetail,
  OfferingBooksListResponse,
  OfferingBundlesListResponse,
  OfferingCourseDetail,
  OfferingCoursesListResponse,
  OfferingTestSeriesListResponse,
  OfferingsBooksQueryParams,
  OfferingsCoursesQueryParams,
  TenantOfferingsSummary,
} from "../types/tenant-offerings.type";
import { PaginationParams } from "../types/tenant.type";

class TenantOfferingsService {
  private async ensureTenant(tenantId: string): Promise<void> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }
  }

  async getSummary(tenantId: string): Promise<TenantOfferingsSummary> {
    await this.ensureTenant(tenantId);
    return tenantOfferingsRepository.getSummary(tenantId);
  }

  async listCourses(
    tenantId: string,
    params: OfferingsCoursesQueryParams
  ): Promise<OfferingCoursesListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantOfferingsRepository.listCourses(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCourseDetail(
    tenantId: string,
    courseId: string
  ): Promise<OfferingCourseDetail> {
    await this.ensureTenant(tenantId);
    const detail = await tenantOfferingsRepository.getCourseDetail(
      tenantId,
      courseId
    );
    if (!detail) {
      throw new NotFoundError(`Course with ID '${courseId}' not found`);
    }
    return detail;
  }

  async listBooks(
    tenantId: string,
    params: OfferingsBooksQueryParams
  ): Promise<OfferingBooksListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantOfferingsRepository.listBooks(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBookDetail(
    tenantId: string,
    bookId: string
  ): Promise<OfferingBookDetail> {
    await this.ensureTenant(tenantId);
    const detail = await tenantOfferingsRepository.getBookDetail(
      tenantId,
      bookId
    );
    if (!detail) {
      throw new NotFoundError(`Book with ID '${bookId}' not found`);
    }
    return detail;
  }

  async listBundles(
    tenantId: string,
    params: PaginationParams
  ): Promise<OfferingBundlesListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantOfferingsRepository.listBundles(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listBatches(
    tenantId: string,
    params: PaginationParams
  ): Promise<OfferingBatchesListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantOfferingsRepository.listBatches(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listTestSeries(
    tenantId: string,
    params: PaginationParams
  ): Promise<OfferingTestSeriesListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantOfferingsRepository.listTestSeries(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export default new TenantOfferingsService();

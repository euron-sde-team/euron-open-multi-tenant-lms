import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import applicationRepository from "../repositories/application.repository";
import featureRepository from "../repositories/feature.repository";
import {
  CreateFeatureRequest,
  FeatureListResponse,
  FeatureQueryParams,
  FeatureResponse,
  UpdateFeatureRequest,
} from "../types/catalog.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

class FeatureService {
  /**
   * Create a new feature
   */
  async createFeature(
    data: CreateFeatureRequest,
    actor: AuditActor
  ): Promise<FeatureResponse> {
    // Validate key format (lowercase letters, numbers, and underscores)
    if (!data.key || !/^[a-z][a-z0-9_]*$/.test(data.key)) {
      throw new BadRequestError(
        "Feature key must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      );
    }

    // Check if key already exists (keys are globally unique)
    const keyExists = await featureRepository.keyExists(data.key);
    if (keyExists) {
      throw new ConflictError("Feature key already exists");
    }

    // Validate application exists
    const application = await applicationRepository.findById(data.application_id);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    if (!application.is_active) {
      throw new ForbiddenError("Cannot create feature for inactive application");
    }

    // Validate navigation fields: when is_navigable is true, nav_route and nav_label are required
    if (data.is_navigable) {
      if (!data.nav_route?.trim()) {
        throw new BadRequestError("nav_route is required when is_navigable is true");
      }
      if (!data.nav_label?.trim()) {
        throw new BadRequestError("nav_label is required when is_navigable is true");
      }
    }

    // Create feature
    const feature = await featureRepository.create({
      id: ulid(),
      application_id: data.application_id,
      key: data.key,
      name: data.name?.trim() ?? null,
      description: data.description?.trim() ?? null,
      category: data.category?.trim() ?? null,
      sort_order: data.sort_order ?? 0,
      is_navigable: data.is_navigable ?? false,
      nav_route: data.nav_route?.trim() ?? null,
      nav_label: data.nav_label?.trim() ?? null,
      nav_icon: data.nav_icon?.trim() ?? null,
      nav_sort_order: data.nav_sort_order ?? 0,
      created_at: new Date(),
    });

    await auditService.record({
      actor,
      action: "FEATURE_CREATED",
      category: "FEATURE",
      resourceId: feature.id,
      resourceLabel: feature.key,
      summary: `Created feature ${feature.key} under application ${application.code}`,
    });

    return {
      ...feature,
      application_code: application.code,
      application_name: application.name,
      product_count: 0,
    };
  }

  /**
   * Get feature by ID
   */
  async getFeatureById(id: string): Promise<FeatureResponse> {
    const feature = await featureRepository.findByIdWithApplication(id);
    if (!feature) {
      throw new NotFoundError("Feature not found");
    }

    const productCount = await featureRepository.countProducts(id);
    return { ...feature, product_count: productCount };
  }

  /**
   * List all features
   */
  async listFeatures(params: FeatureQueryParams): Promise<FeatureListResponse> {
    const limit = params.limit ?? 50;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const [features, total] = await Promise.all([
      featureRepository.findAll({
        application_id: params.application_id,
        category: params.category,
        is_deprecated: params.is_deprecated,
        search: params.search,
        limit,
        offset,
      }),
      featureRepository.count({
        application_id: params.application_id,
        category: params.category,
        is_deprecated: params.is_deprecated,
        search: params.search,
      }),
    ]);

    // Get product counts for each feature
    const featuresWithCounts = await Promise.all(
      features.map(async (feature) => {
        const productCount = await featureRepository.countProducts(feature.id);
        return { ...feature, product_count: productCount };
      })
    );

    return {
      features: featuresWithCounts,
      total,
    };
  }

  /**
   * List features by application ID
   */
  async listFeaturesByApplication(applicationId: string): Promise<FeatureListResponse> {
    // Validate application exists
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    const features = await featureRepository.findByApplicationId(applicationId);
    const total = features.length;

    // Get product counts for each feature
    const featuresWithCounts = await Promise.all(
      features.map(async (feature) => {
        const productCount = await featureRepository.countProducts(feature.id);
        return {
          ...feature,
          application_code: application.code,
          application_name: application.name,
          product_count: productCount,
        };
      })
    );

    return {
      features: featuresWithCounts,
      total,
    };
  }

  /**
   * Update a feature
   */
  async updateFeature(
    id: string,
    data: UpdateFeatureRequest,
    actor: AuditActor
  ): Promise<FeatureResponse> {
    const feature = await featureRepository.findByIdWithApplication(id);
    if (!feature) {
      throw new NotFoundError("Feature not found");
    }

    // Cannot update deprecated features (except to un-deprecate, but we don't support that)
    if (feature.is_deprecated) {
      throw new ForbiddenError("Cannot update deprecated feature");
    }

    // Validate navigation fields: when is_navigable is being set to true, nav_route and nav_label are required
    const effectiveNavigable = data.is_navigable ?? feature.is_navigable;
    if (effectiveNavigable) {
      const effectiveRoute = data.nav_route ?? feature.nav_route;
      const effectiveLabel = data.nav_label ?? feature.nav_label;
      if (!effectiveRoute?.trim()) {
        throw new BadRequestError("nav_route is required when is_navigable is true");
      }
      if (!effectiveLabel?.trim()) {
        throw new BadRequestError("nav_label is required when is_navigable is true");
      }
    }

    const trimOrUndefined = (val: string | undefined): string | null | undefined =>
      val === undefined ? undefined : (val?.trim() ?? null);

    const updatedFeature = await featureRepository.update(id, {
      name: data.name?.trim() ?? null,
      description: data.description?.trim() ?? null,
      category: data.category?.trim() ?? null,
      sort_order: data.sort_order,
      is_navigable: data.is_navigable,
      nav_route: trimOrUndefined(data.nav_route),
      nav_label: trimOrUndefined(data.nav_label),
      nav_icon: trimOrUndefined(data.nav_icon),
      nav_sort_order: data.nav_sort_order,
    });

    if (!updatedFeature) {
      throw new NotFoundError("Feature not found");
    }

    await auditService.record({
      actor,
      action: "FEATURE_UPDATED",
      category: "FEATURE",
      resourceId: updatedFeature.id,
      resourceLabel: updatedFeature.key,
      summary: `Updated feature ${updatedFeature.key}`,
    });

    const productCount = await featureRepository.countProducts(id);
    return {
      ...updatedFeature,
      application_code: feature.application_code,
      application_name: feature.application_name,
      product_count: productCount,
    };
  }

  /**
   * Deprecate a feature (never hard delete)
   */
  async deprecateFeature(
    id: string,
    actor: AuditActor
  ): Promise<FeatureResponse> {
    const feature = await featureRepository.findByIdWithApplication(id);
    if (!feature) {
      throw new NotFoundError("Feature not found");
    }

    if (feature.is_deprecated) {
      throw new ConflictError("Feature is already deprecated");
    }

    const deprecated = await featureRepository.deprecate(id);
    if (!deprecated) {
      throw new NotFoundError("Feature not found");
    }

    const updatedFeature = await featureRepository.findByIdWithApplication(id);
    if (!updatedFeature) {
      throw new NotFoundError("Feature not found");
    }

    await auditService.record({
      actor,
      action: "FEATURE_DEPRECATED",
      category: "FEATURE",
      resourceId: id,
      resourceLabel: feature.key,
      summary: `Deprecated feature ${feature.key}`,
    });

    const productCount = await featureRepository.countProducts(id);
    return { ...updatedFeature, product_count: productCount };
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    return featureRepository.getCategories();
  }
}

export default new FeatureService();

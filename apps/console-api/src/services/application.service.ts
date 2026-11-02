import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import applicationRepository from "../repositories/application.repository";
import {
  encryptApplicationSecret,
  safeDecryptApplicationSecret,
} from "../utils/application-config-crypto";
import {
  ApplicationListResponse,
  ApplicationQueryParams,
  ApplicationResponse,
  CreateApplicationRequest,
  UpdateApplicationRequest,
} from "../types/catalog.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

type ApplicationConfig = Record<string, unknown> | null;

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

class ApplicationService {
  private normalizeConfig(config: ApplicationConfig): ApplicationConfig {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return config ?? null;
    }

    const normalized = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    const provider =
      normalized.provider && typeof normalized.provider === "object" && !Array.isArray(normalized.provider)
        ? { ...(normalized.provider as Record<string, unknown>) }
        : null;

    if (!provider) {
      return normalized;
    }

    const rawApiKey =
      typeof provider.api_key === "string" ? provider.api_key.trim() : undefined;
    const encryptedApiKey =
      typeof provider.api_key_encrypted === "string"
        ? provider.api_key_encrypted
        : undefined;
    const existingApiKey =
      rawApiKey || safeDecryptApplicationSecret(encryptedApiKey) || undefined;

    delete provider.api_key;

    if (rawApiKey) {
      provider.api_key_encrypted = encryptApplicationSecret(rawApiKey);
    }

    if (existingApiKey) {
      provider.has_api_key = true;
      provider.api_key_masked = maskSecret(existingApiKey);
    } else {
      delete provider.api_key_encrypted;
      provider.has_api_key = false;
      provider.api_key_masked = null;
    }

    normalized.provider = provider;
    return normalized;
  }

  private sanitizeConfigForResponse(config: ApplicationConfig): ApplicationConfig {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return config ?? null;
    }

    const sanitized = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    const provider =
      sanitized.provider && typeof sanitized.provider === "object" && !Array.isArray(sanitized.provider)
        ? { ...(sanitized.provider as Record<string, unknown>) }
        : null;

    if (!provider) {
      return sanitized;
    }

    const apiKey =
      typeof provider.api_key === "string"
        ? provider.api_key
        : safeDecryptApplicationSecret(
            typeof provider.api_key_encrypted === "string"
              ? provider.api_key_encrypted
              : null
          ) ?? undefined;

    delete provider.api_key;
    delete provider.api_key_encrypted;
    provider.has_api_key = !!apiKey;
    provider.api_key_masked = apiKey ? maskSecret(apiKey) : null;
    sanitized.provider = provider;

    return sanitized;
  }

  private toResponse(
    application: Omit<ApplicationResponse, "config"> & { config: ApplicationConfig }
  ): ApplicationResponse {
    return {
      ...application,
      config: this.sanitizeConfigForResponse(application.config),
    };
  }

  /**
   * Create a new application
   */
  async createApplication(
    data: CreateApplicationRequest,
    actor: AuditActor
  ): Promise<ApplicationResponse> {
    // Validate code format (lowercase letters, numbers, and underscores)
    if (!data.code || !/^[a-z][a-z0-9_]*$/.test(data.code)) {
      throw new BadRequestError(
        "Application code must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      );
    }

    // Check if code already exists
    const codeExists = await applicationRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Application code already exists");
    }

    // Validate name
    if (!data.name?.trim()) {
      throw new BadRequestError("Application name is required");
    }

    // Create application
    const now = new Date();
    const application = await applicationRepository.create({
      id: ulid(),
      code: data.code,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      icon_url: data.icon_url?.trim() ?? null,
      config: this.normalizeConfig(data.config ?? null),
      is_public: data.is_public ?? true,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    });

    await auditService.record({
      actor,
      action: "APPLICATION_CATALOG_CREATED",
      category: "APPLICATION",
      resourceId: application.id,
      resourceLabel: application.code,
      summary: `Created application ${application.code} (${application.name})`,
    });

    return this.toResponse({
      ...application,
      feature_count: 0,
    });
  }

  /**
   * Get application by ID
   */
  async getApplicationById(id: string): Promise<ApplicationResponse> {
    const application = await applicationRepository.findByIdWithFeatureCount(id);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    return this.toResponse(application);
  }

  /**
   * List all applications
   */
  async listApplications(params: ApplicationQueryParams): Promise<ApplicationListResponse> {
    const limit = params.limit ?? 50;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      applicationRepository.findAll({
        is_active: params.is_active,
        is_public: params.is_public,
        search: params.search,
        limit,
        offset,
      }),
      applicationRepository.count({
        is_active: params.is_active,
        is_public: params.is_public,
        search: params.search,
      }),
    ]);

    // Get feature counts for each application
    const applicationsWithCounts = await Promise.all(
      applications.map(async (app) => {
        const featureCount = await applicationRepository.countFeatures(app.id);
        return this.toResponse({ ...app, feature_count: featureCount });
      })
    );

    return {
      applications: applicationsWithCounts,
      total,
    };
  }

  /**
   * Update an application
   */
  async updateApplication(
    id: string,
    data: UpdateApplicationRequest,
    actor: AuditActor
  ): Promise<ApplicationResponse> {
    const application = await applicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    const updatedApplication = await applicationRepository.update(id, {
      name: data.name?.trim(),
      description: data.description?.trim() ?? null,
      icon_url: data.icon_url?.trim() ?? null,
      config: data.config !== undefined ? this.normalizeConfig(data.config) : undefined,
      is_active: data.is_active,
      is_public: data.is_public,
      sort_order: data.sort_order,
    });

    if (!updatedApplication) {
      throw new NotFoundError("Application not found");
    }

    await auditService.record({
      actor,
      action: "APPLICATION_CATALOG_UPDATED",
      category: "APPLICATION",
      resourceId: updatedApplication.id,
      resourceLabel: updatedApplication.code,
      summary: `Updated application ${updatedApplication.code}`,
    });

    const featureCount = await applicationRepository.countFeatures(id);
    return this.toResponse({ ...updatedApplication, feature_count: featureCount });
  }

  /**
   * Deactivate an application (soft delete)
   */
  async deactivateApplication(id: string, actor: AuditActor): Promise<void> {
    const application = await applicationRepository.findById(id);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    // Check if application has active features
    const featureCount = await applicationRepository.countFeatures(id);
    if (featureCount > 0) {
      throw new ForbiddenError(
        `Cannot deactivate application with ${featureCount} feature(s). Deprecate features first.`
      );
    }

    const deactivated = await applicationRepository.deactivate(id);
    if (!deactivated) {
      throw new NotFoundError("Application not found");
    }

    await auditService.record({
      actor,
      action: "APPLICATION_CATALOG_DEACTIVATED",
      category: "APPLICATION",
      resourceId: id,
      resourceLabel: application.code,
      summary: `Deactivated application ${application.code}`,
    });
  }
}

export default new ApplicationService();

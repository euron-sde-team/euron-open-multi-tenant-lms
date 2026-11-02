import { ulid } from "ulid";
import { storefrontUrlForSlug } from "../utils/tenant-domain.util";
import { ConflictError } from "../errors/conflict-custom.error";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantRepository from "../repositories/tenant.repository";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantDomainService from "./tenant-domain.service";
import {
  CreateOrganizationData,
  CreateOrganizationResponse,
} from "../types/auth.type";
import { isReservedSlug } from "../utils/const";
import logger from "../utils/logger";

class OrganizationService {
  /**
   * Generate URL-safe slug from organization name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  }

  /**
   * Generate a unique slug that is not reserved and doesn't exist in DB
   */
  async generateUniqueSlug(name: string): Promise<string> {
    let slug = this.generateSlug(name);
    let slugAttempt = 1;

    while (
      (isReservedSlug(slug) || (await tenantRepository.slugExists(slug))) &&
      slugAttempt < 100
    ) {
      slug = `${this.generateSlug(name)}-${slugAttempt}`;
      slugAttempt++;
    }

    if (isReservedSlug(slug)) {
      throw new ConflictError(
        "Unable to generate organization slug - name conflicts with reserved keywords"
      );
    }

    if (await tenantRepository.slugExists(slug)) {
      throw new ConflictError("Unable to generate unique organization slug");
    }

    return slug;
  }

  /**
   * Generate a unique slug excluding a specific tenant (for renames)
   */
  async generateUniqueSlugExcluding(
    name: string,
    excludeTenantId: string
  ): Promise<string> {
    let slug = this.generateSlug(name);
    let slugAttempt = 1;

    while (
      (isReservedSlug(slug) ||
        (await tenantRepository.slugExists(slug, excludeTenantId))) &&
      slugAttempt < 100
    ) {
      slug = `${this.generateSlug(name)}-${slugAttempt}`;
      slugAttempt++;
    }

    if (isReservedSlug(slug)) {
      throw new ConflictError(
        "Unable to generate organization slug - name conflicts with reserved keywords"
      );
    }

    if (await tenantRepository.slugExists(slug, excludeTenantId)) {
      throw new ConflictError("Unable to generate unique organization slug");
    }

    return slug;
  }

  /**
   * Update organization name (owner only). Also updates slug.
   */
  async updateOrganizationName(
    tenantId: string,
    userId: string,
    name: string
  ): Promise<{ id: string; name: string; slug: string }> {
    const trimmedName = name?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new BadRequestError(
        "Organization name is required and must be at least 2 characters"
      );
    }

    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    if (tenant.owner_user_id !== userId) {
      throw new ForbiddenError(
        "Only the organization owner can rename the organization"
      );
    }

    // If name unchanged, return early
    if (tenant.name === trimmedName) {
      return { id: tenant.id, name: tenant.name, slug: tenant.slug };
    }

    const newSlug = await this.generateUniqueSlugExcluding(
      trimmedName,
      tenantId
    );

    const updateData: { name: string; slug?: string } = { name: trimmedName };
    if (newSlug !== tenant.slug) {
      updateData.slug = newSlug;
    }

    await tenantRepository.update(tenantId, updateData);

    return {
      id: tenant.id,
      name: trimmedName,
      slug: updateData.slug ?? tenant.slug,
    };
  }

  /**
   * Create a new organization (tenant) for the authenticated user
   */
  async createOrganization(
    userId: string,
    data: CreateOrganizationData
  ): Promise<CreateOrganizationResponse> {
    const { name } = data;

    // Validate name
    if (!name?.trim()) {
      throw new BadRequestError("Organization name is required");
    }

    // Any tenant user may own multiple organizations. The DB one-owner-per-user
    // UNIQUE constraint is dropped (docs/migrations/allow-multiple-owned-orgs.sql),
    // so there is no ownership-count limit here.

    // Generate unique slug
    const slug = await this.generateUniqueSlug(name);

    const now = new Date();
    const tenantId = ulid();
    const membershipId = ulid();

    // Create tenant with user as owner
    const tenant = await tenantRepository.create({
      id: tenantId,
      name: name.trim(),
      slug,
      owner_user_id: userId,
      status: "ACTIVE",
      updated_at: now,
    });

    // Create membership linking user to tenant
    await tenantMembershipRepository.create({
      id: membershipId,
      tenant_id: tenantId,
      user_id: userId,
      status: "ACTIVE",
      joined_at: now,
      created_at: now,
      updated_at: now,
    });

    // Register subdomain (DB-only, wildcard DNS handles routing)
    let subdomainUrl: string | undefined;
    try {
      await tenantDomainService.registerSubdomain(tenantId, slug);
      subdomainUrl = storefrontUrlForSlug(slug);
    } catch (error) {
      logger.error("Failed to register subdomain during organization creation:", error);
      subdomainUrl = storefrontUrlForSlug(slug);
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomainUrl,
    };
  }
}

export default new OrganizationService();

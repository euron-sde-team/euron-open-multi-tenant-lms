import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import applicationRepository from "../repositories/application.repository";
import planRepository from "../repositories/plan.repository";
import productRepository from "../repositories/product.repository";
import {
  AddPlanVersionProductRequest,
  CreatePlanRequest,
  CreatePlanVersionRequest,
  CreatePlanWithVersionRequest,
  CreatePlanWithVersionResponse,
  LinkPlanApplicationRequest,
  PlanApplicationListResponse,
  PlanApplicationResponse,
  PlanListResponse,
  PlanQueryParams,
  PlanResponse,
  PlanVersionListResponse,
  PlanVersionProductResponse,
  PlanVersionResponse,
  UpdatePlanRequest,
  UpdatePlanVersionRequest,
} from "../types/catalog.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

const VALID_PLAN_TYPES = ["SINGLE_APP", "BUNDLE", "ENTERPRISE"];
const VALID_DISCOUNT_TYPES = ["NONE", "PERCENTAGE", "FIXED"];
const VALID_PRICING_FREQUENCIES = ["MONTHLY", "YEARLY", "TWO_YEARLY", "BOTH", "ALL"];
const VALID_PURCHASE_MODES = ["FREE", "PAID"];

class PlanService {
  // ============================================
  // PLAN CRUD
  // ============================================

  /**
   * Create a new plan
   */
  async createPlan(
    data: CreatePlanRequest,
    actor: AuditActor
  ): Promise<PlanResponse> {
    // Validate code format (lowercase letters, numbers, and underscores)
    if (!data.code || !/^[a-z][a-z0-9_]*$/.test(data.code)) {
      throw new BadRequestError(
        "Plan code must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      );
    }

    // Validate plan type
    if (data.plan_type && !VALID_PLAN_TYPES.includes(data.plan_type)) {
      throw new BadRequestError(`Plan type must be one of: ${VALID_PLAN_TYPES.join(", ")}`);
    }

    // Check if code already exists
    const codeExists = await planRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Plan code already exists");
    }

    // Validate name
    if (!data.name?.trim()) {
      throw new BadRequestError("Plan name is required");
    }

    // Create plan
    const now = new Date();
    const plan = await planRepository.create({
      id: ulid(),
      code: data.code,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      plan_type: data.plan_type ?? "SINGLE_APP",
      sort_order: data.sort_order ?? 0,
      is_public: data.is_public ?? true,
      created_at: now,
      updated_at: now,
    });

    await auditService.record({
      actor,
      action: "PLAN_CREATED",
      category: "PLAN",
      resourceId: plan.id,
      resourceLabel: plan.code,
      summary: `Created plan ${plan.code} (${plan.name})`,
    });

    return {
      ...plan,
      active_version: null,
      latest_version: null,
      version_count: 0,
      applications: [],
    };
  }

  /**
   * Create a new plan with its first version (version 1) atomically
   */
  async createPlanWithVersion(
    data: CreatePlanWithVersionRequest,
    actor: AuditActor
  ): Promise<CreatePlanWithVersionResponse> {
    // Validate code format (lowercase letters, numbers, and underscores)
    if (!data.code || !/^[a-z][a-z0-9_]*$/.test(data.code)) {
      throw new BadRequestError(
        "Plan code must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      );
    }

    // Validate plan type
    if (data.plan_type && !VALID_PLAN_TYPES.includes(data.plan_type)) {
      throw new BadRequestError(
        `Plan type must be one of: ${VALID_PLAN_TYPES.join(", ")}`
      );
    }

    // Check if code already exists
    const codeExists = await planRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Plan code already exists");
    }

    // Validate name
    if (!data.name?.trim()) {
      throw new BadRequestError("Plan name is required");
    }

    // Create plan and version atomically
    const now = new Date();
    const planId = ulid();
    const versionId = ulid();

    const { plan, version } = await planRepository.createPlanWithVersion(
      {
        id: planId,
        code: data.code,
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        plan_type: data.plan_type ?? "SINGLE_APP",
        sort_order: data.sort_order ?? 0,
        is_public: data.is_public ?? true,
        created_at: now,
        updated_at: now,
      },
      {
        id: versionId,
        plan_id: planId,
        version: 1, // First version is always 1
        pricing_frequency: data.pricing_frequency ?? "BOTH",
        price_monthly_inr: data.price_monthly_inr ?? 0,
        price_yearly_inr: data.price_yearly_inr ?? 0,
        discount_monthly_inr_type: "NONE",
        discount_monthly_inr_value: 0,
        discount_yearly_inr_type: "NONE",
        discount_yearly_inr_value: 0,
        price_monthly_usd: data.price_monthly_usd ?? 0,
        price_yearly_usd: data.price_yearly_usd ?? 0,
        discount_monthly_usd_type: "NONE",
        discount_monthly_usd_value: 0,
        discount_yearly_usd_type: "NONE",
        discount_yearly_usd_value: 0,
        is_active: false, // New versions are not active by default
        created_at: now,
      }
    );

    // Link applications to the plan if provided
    const linkedApps: Array<{ id: string; code: string; name: string }> = [];
    if (data.application_ids && data.application_ids.length > 0) {
      for (const appId of data.application_ids) {
        const already = await planRepository.hasApplication(planId, appId);
        if (!already) {
          await planRepository.linkApplication({
            id: ulid(),
            plan_id: planId,
            application_id: appId,
          });
        }
      }
      // Fetch linked applications for the response
      const apps = await planRepository.getPlanApplications(planId);
      linkedApps.push(
        ...apps.map((a) => ({
          id: a.application_id,
          code: a.application_code,
          name: a.application_name,
        }))
      );
    }

    await auditService.record({
      actor,
      action: "PLAN_CREATED",
      category: "PLAN",
      resourceId: plan.id,
      resourceLabel: plan.code,
      summary: `Created plan ${plan.code} (${plan.name}) with version 1`,
    });

    return {
      plan: {
        ...plan,
        active_version: null,
        latest_version: this.buildVersionSummary(version),
        version_count: 1,
        applications: linkedApps,
      },
      version: {
        ...version,
        products: [],
      },
    };
  }

  /**
   * Get plan by ID with versions and applications
   */
  async getPlanById(id: string): Promise<PlanResponse> {
    const plan = await planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const [activeVersion, latestVersion, versionCount, applications] = await Promise.all([
      planRepository.findActiveVersion(id),
      planRepository.findLatestVersion(id),
      planRepository.countVersions(id),
      planRepository.getPlanApplications(id),
    ]);

    return {
      ...plan,
      active_version: activeVersion ? this.buildVersionSummary(activeVersion) : null,
      latest_version: latestVersion ? this.buildVersionSummary(latestVersion) : null,
      version_count: versionCount,
      applications: applications.map((a) => ({
        id: a.application_id,
        code: a.application_code,
        name: a.application_name,
      })),
    };
  }

  /**
   * List all plans
   */
  async listPlans(params: PlanQueryParams): Promise<PlanListResponse> {
    const limit = params.limit ?? 50;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const [plans, total] = await Promise.all([
      planRepository.findAll({
        plan_type: params.plan_type,
        is_active: params.is_active,
        is_public: params.is_public,
        has_active_version: params.has_active_version,
        search: params.search,
        limit,
        offset,
      }),
      planRepository.count({
        plan_type: params.plan_type,
        is_active: params.is_active,
        is_public: params.is_public,
        has_active_version: params.has_active_version,
        search: params.search,
      }),
    ]);

    // Get active version, latest version and counts for each plan
    const plansWithDetails = await Promise.all(
      plans.map(async (plan) => {
        const [activeVersion, latestVersion, versionCount, applications] = await Promise.all([
          planRepository.findActiveVersion(plan.id),
          planRepository.findLatestVersion(plan.id),
          planRepository.countVersions(plan.id),
          planRepository.getPlanApplications(plan.id),
        ]);

        return {
          ...plan,
          active_version: activeVersion ? this.buildVersionSummary(activeVersion) : null,
          latest_version: latestVersion ? this.buildVersionSummary(latestVersion) : null,
          version_count: versionCount,
          applications: applications.map((a) => ({
            id: a.application_id,
            code: a.application_code,
            name: a.application_name,
          })),
        };
      })
    );

    return {
      plans: plansWithDetails,
      total,
    };
  }

  /**
   * Update a plan
   */
  async updatePlan(
    id: string,
    data: UpdatePlanRequest,
    actor: AuditActor
  ): Promise<PlanResponse> {
    const plan = await planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const updatedPlan = await planRepository.update(id, {
      name: data.name?.trim(),
      description: data.description?.trim() ?? null,
      sort_order: data.sort_order,
      is_active: data.is_active,
      is_public: data.is_public,
    });

    if (!updatedPlan) {
      throw new NotFoundError("Plan not found");
    }

    await auditService.record({
      actor,
      action: "PLAN_UPDATED",
      category: "PLAN",
      resourceId: updatedPlan.id,
      resourceLabel: updatedPlan.code,
      summary: `Updated plan ${updatedPlan.code}`,
    });

    return this.getPlanById(id);
  }

  /**
   * Deactivate a plan (soft delete)
   */
  async deactivatePlan(id: string, actor: AuditActor): Promise<void> {
    const plan = await planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    // Check for active subscriptions
    const hasSubscriptions = await planRepository.hasActiveSubscriptions(id);
    if (hasSubscriptions) {
      throw new ForbiddenError(
        "Cannot deactivate plan with active subscriptions. Cancel subscriptions first."
      );
    }

    const deactivated = await planRepository.deactivate(id);
    if (!deactivated) {
      throw new NotFoundError("Plan not found");
    }

    await auditService.record({
      actor,
      action: "PLAN_ARCHIVED",
      category: "PLAN",
      resourceId: id,
      resourceLabel: plan.code,
      summary: `Deactivated plan ${plan.code}`,
    });
  }

  // ============================================
  // PLAN VERSION CRUD
  // ============================================

  /**
   * Create a new plan version (with products - atomic transaction)
   */
  async createPlanVersion(
    planId: string,
    data: CreatePlanVersionRequest,
    actor: AuditActor
  ): Promise<PlanVersionResponse> {
    // Validate plan exists
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    // Validate purchase_mode
    const purchaseMode = data.purchase_mode ?? "PAID";
    if (!VALID_PURCHASE_MODES.includes(purchaseMode)) {
      throw new BadRequestError(`purchase_mode must be one of: ${VALID_PURCHASE_MODES.join(", ")}`);
    }

    // Validate pricing (skip for FREE plans)
    if (purchaseMode !== "FREE") {
      this.validatePricing(data);
    }

    // Validate offer dates if provided
    this.validateOfferDates(data.offer_valid_from, data.offer_valid_to);

    // Validate products if provided
    if (data.products && data.products.length > 0) {
      await this.validateProducts(data.products);
    }

    // Get next version number
    const nextVersion = await planRepository.getNextVersionNumber(planId);

    // Prepare products with IDs
    const productsWithIds = (data.products ?? []).map((p) => ({
      id: ulid(),
      product_id: p.product_id,
      limit_value: p.limit_value,
      is_unlimited: p.is_unlimited ?? false,
    }));

    // Determine pricing frequency and defaults
    const pricingFrequency = data.pricing_frequency || "BOTH";

    // Create version with products (atomic)
    const version = await planRepository.createVersionWithProducts(
      {
        id: ulid(),
        plan_id: planId,
        version: nextVersion,
        pricing_frequency: pricingFrequency,
        purchase_mode: purchaseMode,
        // Monthly pricing (default to 0 if not required by frequency)
        price_monthly_inr: data.price_monthly_inr ?? 0,
        price_yearly_inr: data.price_yearly_inr ?? 0,
        discount_monthly_inr_type: data.discount_monthly_inr_type ?? "NONE",
        discount_monthly_inr_value: data.discount_monthly_inr_value ?? 0,
        discount_yearly_inr_type: data.discount_yearly_inr_type ?? "NONE",
        discount_yearly_inr_value: data.discount_yearly_inr_value ?? 0,
        // USD pricing (default to 0 if not required by frequency)
        price_monthly_usd: data.price_monthly_usd ?? 0,
        price_yearly_usd: data.price_yearly_usd ?? 0,
        discount_monthly_usd_type: data.discount_monthly_usd_type ?? "NONE",
        discount_monthly_usd_value: data.discount_monthly_usd_value ?? 0,
        discount_yearly_usd_type: data.discount_yearly_usd_type ?? "NONE",
        discount_yearly_usd_value: data.discount_yearly_usd_value ?? 0,
        // Two-yearly pricing
        price_two_yearly_inr: data.price_two_yearly_inr ?? 0,
        price_two_yearly_usd: data.price_two_yearly_usd ?? 0,
        discount_two_yearly_inr_type: data.discount_two_yearly_inr_type ?? "NONE",
        discount_two_yearly_inr_value: data.discount_two_yearly_inr_value ?? 0,
        discount_two_yearly_usd_type: data.discount_two_yearly_usd_type ?? "NONE",
        discount_two_yearly_usd_value: data.discount_two_yearly_usd_value ?? 0,
        is_active: false, // New versions are not active by default
        // Offer metadata
        is_offer: data.is_offer ?? false,
        offer_name: data.offer_name ?? null,
        offer_description: data.offer_description ?? null,
        offer_valid_from: data.offer_valid_from ? new Date(data.offer_valid_from) : null,
        offer_valid_to: data.offer_valid_to ? new Date(data.offer_valid_to) : null,
        created_at: new Date(),
      },
      productsWithIds
    );

    // Get products for response
    const products = await planRepository.getVersionProducts(version.id);

    await auditService.record({
      actor,
      action: "PLAN_VERSION_CREATED",
      category: "PLAN",
      resourceId: version.id,
      resourceLabel: `${plan.code} v${version.version}`,
      summary: `Created version ${version.version} of plan ${plan.code}`,
    });

    return {
      ...version,
      products,
    };
  }

  /**
   * Update a draft plan version (only for unpublished versions)
   */
  async updatePlanVersion(
    planId: string,
    versionId: string,
    data: UpdatePlanVersionRequest,
    actor: AuditActor
  ): Promise<PlanVersionResponse> {
    // Validate version exists and belongs to plan
    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    // Check if version is published (cannot modify published versions)
    if (version.is_active || version.published_at) {
      throw new ForbiddenError(
        "Cannot modify a published version. Published versions are immutable."
      );
    }

    // Check if version is retired
    if (version.retired_at) {
      throw new ForbiddenError("Cannot modify a retired version.");
    }

    // Validate discount types if provided
    if (
      data.discount_monthly_inr_type &&
      !VALID_DISCOUNT_TYPES.includes(data.discount_monthly_inr_type)
    ) {
      throw new BadRequestError(
        `Invalid discount type. Must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
      );
    }
    if (
      data.discount_yearly_inr_type &&
      !VALID_DISCOUNT_TYPES.includes(data.discount_yearly_inr_type)
    ) {
      throw new BadRequestError(
        `Invalid discount type. Must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
      );
    }
    if (
      data.discount_monthly_usd_type &&
      !VALID_DISCOUNT_TYPES.includes(data.discount_monthly_usd_type)
    ) {
      throw new BadRequestError(
        `Invalid discount type. Must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
      );
    }
    if (
      data.discount_yearly_usd_type &&
      !VALID_DISCOUNT_TYPES.includes(data.discount_yearly_usd_type)
    ) {
      throw new BadRequestError(
        `Invalid discount type. Must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
      );
    }

    // Validate pricing values are non-negative if provided
    if (data.price_monthly_inr !== undefined && data.price_monthly_inr < 0) {
      throw new BadRequestError("Monthly INR price cannot be negative");
    }
    if (data.price_yearly_inr !== undefined && data.price_yearly_inr < 0) {
      throw new BadRequestError("Yearly INR price cannot be negative");
    }
    if (data.price_monthly_usd !== undefined && data.price_monthly_usd < 0) {
      throw new BadRequestError("Monthly USD price cannot be negative");
    }
    if (data.price_yearly_usd !== undefined && data.price_yearly_usd < 0) {
      throw new BadRequestError("Yearly USD price cannot be negative");
    }

    // Validate offer dates if both are provided
    this.validateOfferDates(data.offer_valid_from, data.offer_valid_to);

    // Validate purchase_mode if provided
    if (data.purchase_mode && !VALID_PURCHASE_MODES.includes(data.purchase_mode)) {
      throw new BadRequestError(`purchase_mode must be one of: ${VALID_PURCHASE_MODES.join(", ")}`);
    }

    // Prepare update data, converting string dates to Date objects
    const updateData = {
      purchase_mode: data.purchase_mode,
      price_monthly_inr: data.price_monthly_inr,
      price_yearly_inr: data.price_yearly_inr,
      discount_monthly_inr_type: data.discount_monthly_inr_type,
      discount_monthly_inr_value: data.discount_monthly_inr_value,
      discount_yearly_inr_type: data.discount_yearly_inr_type,
      discount_yearly_inr_value: data.discount_yearly_inr_value,
      price_monthly_usd: data.price_monthly_usd,
      price_yearly_usd: data.price_yearly_usd,
      discount_monthly_usd_type: data.discount_monthly_usd_type,
      discount_monthly_usd_value: data.discount_monthly_usd_value,
      discount_yearly_usd_type: data.discount_yearly_usd_type,
      discount_yearly_usd_value: data.discount_yearly_usd_value,
      // Two-yearly pricing
      price_two_yearly_inr: data.price_two_yearly_inr,
      price_two_yearly_usd: data.price_two_yearly_usd,
      discount_two_yearly_inr_type: data.discount_two_yearly_inr_type,
      discount_two_yearly_inr_value: data.discount_two_yearly_inr_value,
      discount_two_yearly_usd_type: data.discount_two_yearly_usd_type,
      discount_two_yearly_usd_value: data.discount_two_yearly_usd_value,
      is_offer: data.is_offer,
      offer_name: data.offer_name,
      offer_description: data.offer_description,
      offer_valid_from: data.offer_valid_from ? new Date(data.offer_valid_from) : data.offer_valid_from === null ? null : undefined,
      offer_valid_to: data.offer_valid_to ? new Date(data.offer_valid_to) : data.offer_valid_to === null ? null : undefined,
    };

    // Update the version
    const updatedVersion = await planRepository.updateVersion(versionId, updateData);

    // Get products for response
    const products = await planRepository.getVersionProducts(versionId);

    await auditService.record({
      actor,
      action: "PLAN_VERSION_UPDATED",
      category: "PLAN",
      resourceId: versionId,
      resourceLabel: `Plan version ${version.version}`,
      summary: `Updated draft version ${version.version} of plan ${planId}`,
    });

    return {
      ...updatedVersion,
      products,
    };
  }

  /**
   * Get plan version by ID
   */
  async getPlanVersionById(planId: string, versionId: string): Promise<PlanVersionResponse> {
    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    const products = await planRepository.getVersionProducts(versionId);

    return {
      ...version,
      products,
    };
  }

  /**
   * List all versions for a plan
   */
  async listPlanVersions(planId: string): Promise<PlanVersionListResponse> {
    // Validate plan exists
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const versions = await planRepository.findVersionsByPlanId(planId);

    // Get products for each version
    const versionsWithProducts = await Promise.all(
      versions.map(async (version) => {
        const products = await planRepository.getVersionProducts(version.id);
        return { ...version, products };
      })
    );

    return {
      versions: versionsWithProducts,
      total: versions.length,
    };
  }

  /**
   * Publish a plan version (makes it active, deactivates current active)
   */
  async publishPlanVersion(
    planId: string,
    versionId: string,
    actor: AuditActor
  ): Promise<PlanVersionResponse> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    if (version.is_active) {
      throw new ConflictError("Plan version is already active");
    }

    // Note: We allow republishing retired versions to support offer cycling
    // (e.g., switching between normal and promotional versions)

    // Publish (deactivate old, activate new)
    const publishedVersion = await planRepository.publishVersion(planId, versionId);
    const products = await planRepository.getVersionProducts(versionId);

    await auditService.record({
      actor,
      action: "PLAN_VERSION_PUBLISHED",
      category: "PLAN",
      resourceId: versionId,
      resourceLabel: `${plan.code} v${version.version}`,
      summary: `Published version ${version.version} of plan ${plan.code}`,
    });

    return {
      ...publishedVersion,
      products,
    };
  }

  /**
   * Retire a plan version
   */
  async retirePlanVersion(
    planId: string,
    versionId: string,
    actor: AuditActor
  ): Promise<PlanVersionResponse> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    if (version.retired_at) {
      throw new ConflictError("Plan version is already retired");
    }

    const retiredVersion = await planRepository.retireVersion(versionId);
    const products = await planRepository.getVersionProducts(versionId);

    await auditService.record({
      actor,
      action: "PLAN_VERSION_ARCHIVED",
      category: "PLAN",
      resourceId: versionId,
      resourceLabel: `${plan.code} v${version.version}`,
      summary: `Retired version ${version.version} of plan ${plan.code}`,
    });

    return {
      ...retiredVersion,
      products,
    };
  }

  // ============================================
  // PLAN VERSION PRODUCTS
  // ============================================

  /**
   * Add product to plan version
   */
  async addVersionProduct(
    planId: string,
    versionId: string,
    data: AddPlanVersionProductRequest
  ): Promise<PlanVersionProductResponse> {
    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    // Cannot modify published/active versions
    if (version.is_active || version.published_at) {
      throw new ForbiddenError("Cannot modify a published or active version");
    }

    // Validate product exists
    const product = await productRepository.findByIdWithDetails(data.product_id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    // Check if already exists
    const hasProduct = await planRepository.hasVersionProduct(versionId, data.product_id);
    if (hasProduct) {
      throw new ConflictError("Product already exists in this version");
    }

    const versionProduct = await planRepository.addVersionProduct({
      id: ulid(),
      plan_version_id: versionId,
      product_id: data.product_id,
      limit_value: data.limit_value,
      is_unlimited: data.is_unlimited ?? false,
    });

    return {
      ...versionProduct,
      product_code: product.code,
      feature_key: product.feature_key,
      constraint_type: product.constraint_type,
      unit: product.unit,
    };
  }

  /**
   * Remove product from plan version
   */
  async removeVersionProduct(
    planId: string,
    versionId: string,
    productId: string
  ): Promise<void> {
    const version = await planRepository.findVersionById(versionId);
    if (!version || version.plan_id !== planId) {
      throw new NotFoundError("Plan version not found");
    }

    // Cannot modify published/active versions
    if (version.is_active || version.published_at) {
      throw new ForbiddenError("Cannot modify a published or active version");
    }

    const removed = await planRepository.removeVersionProduct(versionId, productId);
    if (!removed) {
      throw new NotFoundError("Product not found in this version");
    }
  }

  // ============================================
  // PLAN APPLICATIONS
  // ============================================

  /**
   * Get applications linked to a plan
   */
  async getPlanApplications(planId: string): Promise<PlanApplicationListResponse> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const applications = await planRepository.getPlanApplications(planId);

    return {
      applications,
      total: applications.length,
    };
  }

  /**
   * Link application to plan
   */
  async linkApplication(
    planId: string,
    data: LinkPlanApplicationRequest
  ): Promise<PlanApplicationResponse> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const application = await applicationRepository.findById(data.application_id);
    if (!application) {
      throw new NotFoundError("Application not found");
    }

    // Check if already linked
    const hasApp = await planRepository.hasApplication(planId, data.application_id);
    if (hasApp) {
      throw new ConflictError("Application already linked to this plan");
    }

    const planApp = await planRepository.linkApplication({
      id: ulid(),
      plan_id: planId,
      application_id: data.application_id,
    });

    return {
      ...planApp,
      application_code: application.code,
      application_name: application.name,
    };
  }

  /**
   * Unlink application from plan
   */
  async unlinkApplication(planId: string, applicationId: string): Promise<void> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    const unlinked = await planRepository.unlinkApplication(planId, applicationId);
    if (!unlinked) {
      throw new NotFoundError("Application not linked to this plan");
    }
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  private validatePricing(data: CreatePlanVersionRequest): void {
    const frequency = data.pricing_frequency || "BOTH";

    // Validate pricing_frequency if provided
    if (data.pricing_frequency && !VALID_PRICING_FREQUENCIES.includes(data.pricing_frequency)) {
      throw new BadRequestError(
        `pricing_frequency must be one of: ${VALID_PRICING_FREQUENCIES.join(", ")}`
      );
    }

    // Conditionally required pricing fields based on frequency
    const requiresMonthly = frequency === "MONTHLY" || frequency === "BOTH" || frequency === "ALL";
    const requiresYearly = frequency === "YEARLY" || frequency === "BOTH" || frequency === "ALL";
    const requiresTwoYearly = frequency === "TWO_YEARLY" || frequency === "ALL";

    // Monthly pricing validation
    if (requiresMonthly) {
      if (data.price_monthly_inr === undefined || data.price_monthly_inr < 0) {
        throw new BadRequestError("Monthly INR price is required and must be non-negative");
      }
      if (data.price_monthly_usd === undefined || data.price_monthly_usd < 0) {
        throw new BadRequestError("Monthly USD price is required and must be non-negative");
      }
    }

    // Yearly pricing validation
    if (requiresYearly) {
      if (data.price_yearly_inr === undefined || data.price_yearly_inr < 0) {
        throw new BadRequestError("Yearly INR price is required and must be non-negative");
      }
      if (data.price_yearly_usd === undefined || data.price_yearly_usd < 0) {
        throw new BadRequestError("Yearly USD price is required and must be non-negative");
      }
    }

    // Two-yearly pricing validation
    if (requiresTwoYearly) {
      if (data.price_two_yearly_inr === undefined || data.price_two_yearly_inr < 0) {
        throw new BadRequestError("Two-yearly INR price is required and must be non-negative");
      }
      if (data.price_two_yearly_usd === undefined || data.price_two_yearly_usd < 0) {
        throw new BadRequestError("Two-yearly USD price is required and must be non-negative");
      }
    }

    // Validate discount types if provided (for applicable fields based on frequency)
    const discountFields: string[] = [];
    if (requiresMonthly) {
      discountFields.push("discount_monthly_inr_type", "discount_monthly_usd_type");
    }
    if (requiresYearly) {
      discountFields.push("discount_yearly_inr_type", "discount_yearly_usd_type");
    }
    if (requiresTwoYearly) {
      discountFields.push("discount_two_yearly_inr_type", "discount_two_yearly_usd_type");
    }

    for (const field of discountFields) {
      const value = (data as unknown as Record<string, unknown>)[field];
      if (value && !VALID_DISCOUNT_TYPES.includes(value as string)) {
        throw new BadRequestError(
          `${field} must be one of: ${VALID_DISCOUNT_TYPES.join(", ")}`
        );
      }
    }
  }

  private async validateProducts(
    products: Array<{ product_id: string; limit_value: number; is_unlimited?: boolean }>
  ): Promise<void> {
    // Check for duplicate product IDs
    const productIds = products.map((p) => p.product_id);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestError("Duplicate product IDs in version products");
    }

    // Validate each product exists
    const existingProducts = await productRepository.findByIds(productIds);
    const existingIds = new Set(existingProducts.map((p) => p.id));

    for (const productId of productIds) {
      if (!existingIds.has(productId)) {
        throw new NotFoundError(`Product with ID ${productId} not found`);
      }
    }

    // Validate limit values
    for (const product of products) {
      if (!product.is_unlimited && (product.limit_value === undefined || product.limit_value < 0)) {
        throw new BadRequestError(
          `Limit value is required and must be non-negative for product ${product.product_id}`
        );
      }
    }
  }

  /**
   * Build version summary for plan responses
   */
  private buildVersionSummary(version: {
    id: string;
    version: number;
    is_active: boolean;
    pricing_frequency: string;
    purchase_mode?: string;
    price_monthly_inr: number;
    price_yearly_inr: number;
    price_monthly_usd: number;
    price_yearly_usd: number;
    price_two_yearly_inr?: number | null;
    price_two_yearly_usd?: number | null;
    published_at: Date | null;
    is_offer: boolean;
    offer_name: string | null;
    offer_valid_from: Date | null;
    offer_valid_to: Date | null;
  }) {
    return {
      id: version.id,
      version: version.version,
      is_active: version.is_active,
      pricing_frequency: version.pricing_frequency as "MONTHLY" | "YEARLY" | "TWO_YEARLY" | "BOTH" | "ALL",
      purchase_mode: (version.purchase_mode ?? "PAID") as "FREE" | "PAID",
      price_monthly_inr: version.price_monthly_inr,
      price_yearly_inr: version.price_yearly_inr,
      price_monthly_usd: version.price_monthly_usd,
      price_yearly_usd: version.price_yearly_usd,
      price_two_yearly_inr: Number(version.price_two_yearly_inr ?? 0),
      price_two_yearly_usd: Number(version.price_two_yearly_usd ?? 0),
      published_at: version.published_at,
      is_offer: version.is_offer,
      offer_name: version.offer_name,
      offer_valid_from: version.offer_valid_from,
      offer_valid_to: version.offer_valid_to,
    };
  }

  /**
   * Validate offer dates - if both are provided, valid_from must be before valid_to
   */
  private validateOfferDates(
    validFrom?: Date | string | null,
    validTo?: Date | string | null
  ): void {
    if (validFrom && validTo) {
      const fromDate = new Date(validFrom);
      const toDate = new Date(validTo);

      if (isNaN(fromDate.getTime())) {
        throw new BadRequestError("Invalid offer_valid_from date format");
      }
      if (isNaN(toDate.getTime())) {
        throw new BadRequestError("Invalid offer_valid_to date format");
      }
      if (fromDate >= toDate) {
        throw new BadRequestError("offer_valid_from must be before offer_valid_to");
      }
    }
  }
}

export default new PlanService();

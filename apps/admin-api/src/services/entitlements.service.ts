import entitlementsRepository, {
  type EntitlementRow,
} from "../repositories/entitlements.repository";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import usageService from "./usage.service";
import { db } from "../db/connection";

const WARNING_THRESHOLD = 2; // warn when remaining slots <= this

export interface EntitlementDto {
  feature_key: string;
  product_code: string;
  limit_value: number;
  used_value: number;
  is_unlimited: boolean;
  unit?: string;
  source?: string;
  warning?: boolean;
  remainingSlots?: number;
  /** Usage window type from product definition */
  usage_window?: string;
}

export interface CheckCapacityResult {
  allowed: boolean;
  entitlement?: EntitlementDto;
  currentUsed?: number;
  limit?: number;
  isUnlimited?: boolean;
  remainingSlots?: number;
  warning?: boolean;
}

/**
 * Check if a BOOLEAN-style entitlement is effectively "on" (limit_value >= 1 or is_unlimited)
 */
function isBooleanEntitlementEnabled(row: EntitlementRow): boolean {
  return Boolean(row.is_unlimited) || row.limit_value >= 1;
}

/**
 * Build DTO from entitlement row + counter usage value.
 */
function toDto(row: EntitlementRow, usedValue: number, addWarning = true): EntitlementDto {
  const isUnlimited = Boolean(row.is_unlimited);
  const limit = row.limit_value;
  const remaining = isUnlimited ? undefined : Math.max(0, limit - usedValue);
  const warning =
    addWarning &&
    !isUnlimited &&
    remaining !== undefined &&
    remaining <= WARNING_THRESHOLD;

  const dto: EntitlementDto = {
    feature_key: row.feature_key,
    product_code: row.product_code,
    limit_value: limit,
    used_value: usedValue,
    is_unlimited: isUnlimited,
    source: row.source != null ? String(row.source) : undefined,
  };
  if (warning && remaining !== undefined) {
    dto.warning = true;
    dto.remainingSlots = remaining;
  }
  return dto;
}

export interface LinkableProductDto {
  product_code: string;
  product_title: string | null;
  constraint_type: string;
  unit: string | null;
  usage_scope: string;
  usage_window: string;
  feature_key: string;
  feature_name: string | null;
  limit_value: number;
  is_unlimited: boolean;
}

class EntitlementsService {
  /**
   * Get entitlements for a tenant, with used_value sourced from usage counters.
   */
  async getEntitlementsForTenant(tenantId: string): Promise<EntitlementDto[]> {
    const [rows, usageMap] = await Promise.all([
      entitlementsRepository.findActiveByTenantId(tenantId),
      usageService.getAllUsage(tenantId),
    ]);

    // Deduplicate by product_code, keep first row per product_code
    // (ordering is by feature_key, product_code from the repo)
    const seen = new Map<string, EntitlementRow>();
    for (const row of rows) {
      if (!seen.has(row.product_code)) {
        seen.set(row.product_code, row);
      }
    }

    // Look up usage_window for each product code
    const productCodes = Array.from(seen.keys());
    const windowMap = new Map<string, string>();
    if (productCodes.length > 0) {
      const products = await db
        .selectFrom("products")
        .select(["code", "usage_window"])
        .where("code", "in", productCodes)
        .execute();
      for (const p of products) {
        windowMap.set(p.code, (p.usage_window as string) ?? "LIFETIME");
      }
    }

    return Array.from(seen.values()).map((row) => {
      const usedValue = usageMap.get(row.product_code) ?? 0;
      const dto = toDto(row, usedValue, true);
      dto.usage_window = windowMap.get(row.product_code) ?? "LIFETIME";
      return dto;
    });
  }

  /**
   * Check capacity using usage counters instead of entitlements.used_value.
   */
  async checkCapacity(
    tenantId: string,
    productCode: string,
    amount: number = 1
  ): Promise<CheckCapacityResult> {
    const result = await usageService.checkCapacity(tenantId, productCode, amount);

    if (result.isUnlimited) {
      return {
        allowed: result.allowed,
        currentUsed: result.currentUsed,
        limit: result.limit,
        isUnlimited: true,
      };
    }

    return {
      allowed: result.allowed,
      currentUsed: result.currentUsed,
      limit: result.limit,
      isUnlimited: result.isUnlimited,
      remainingSlots: result.remainingSlots,
      warning: result.warning,
    };
  }

  /**
   * Ensure self-paced courses feature is enabled (BOOLEAN entitlement).
   * Throws EntitlementForbiddenError if not enabled.
   */
  async ensureSelfPacedCoursesEnabled(tenantId: string): Promise<void> {
    await this.ensureBooleanEntitlement(
      tenantId,
      "self_paced_courses_enabled",
      "self_paced_courses",
      "Self-paced courses are not enabled on your plan. Upgrade to add courses."
    );
  }

  /**
   * Ensure AI authoring (course/book/batch/page/test generation) is enabled.
   */
  async ensureAiAuthoringEnabled(tenantId: string): Promise<void> {
    await this.ensureBooleanEntitlement(
      tenantId,
      "ai_authoring_enabled",
      "ai_authoring",
      "AI authoring is not enabled on your plan. Upgrade to generate content with AI."
    );
  }

  /** quizzes_enabled gates creating quizzes (lesson quizzes and standalone). */
  async ensureQuizzesEnabled(tenantId: string): Promise<void> {
    await this.ensureBooleanEntitlement(
      tenantId,
      "quizzes_enabled",
      "quizzes",
      "Quizzes are not enabled on your plan. Upgrade to add quizzes."
    );
  }

  /** assignments_enabled gates creating assignments. */
  async ensureAssignmentsEnabled(tenantId: string): Promise<void> {
    await this.ensureBooleanEntitlement(
      tenantId,
      "assignments_enabled",
      "assignments",
      "Assignments are not enabled on your plan. Upgrade to add assignments."
    );
  }

  /**
   * Max questions per quiz (quiz_questions_per_quiz LIMIT). null = unlimited.
   * Default deny: a missing or inactive row allows 0 questions.
   */
  async getQuizQuestionsLimit(tenantId: string): Promise<number | null> {
    const row = await entitlementsRepository.findByTenantAndProduct(
      tenantId,
      "quiz_questions_per_quiz"
    );
    if (!row || !row.is_active) return 0;
    if (row.is_unlimited) return null;
    return Math.max(0, row.limit_value ?? 0);
  }

  /**
   * Throws ENTITLEMENT_LIMIT_REACHED when adding `adding` questions to a quiz
   * that already holds `currentCount` would pass quiz_questions_per_quiz.
   */
  async ensureQuizQuestionCapacity(
    tenantId: string,
    currentCount: number,
    adding: number
  ): Promise<void> {
    const limit = await this.getQuizQuestionsLimit(tenantId);
    if (limit === null || currentCount + adding <= limit) return;
    throw new EntitlementForbiddenError(
      `Quiz question limit reached (max ${limit} per quiz). Upgrade your plan for more.`,
      {
        code: "ENTITLEMENT_LIMIT_REACHED",
        productCode: "quiz_questions_per_quiz",
        featureKey: "quizzes",
        currentUsed: currentCount,
        limit,
        isUnlimited: false,
      }
    );
  }

  /**
   * Generic boolean entitlement check. Throws EntitlementForbiddenError if the
   * product is not enabled. Callers provide the product code, feature key, and
   * a human-readable message.
   */
  async ensureBooleanEntitlement(
    tenantId: string,
    productCode: string,
    featureKey: string,
    message: string
  ): Promise<void> {
    const row = await entitlementsRepository.findByTenantAndProduct(
      tenantId,
      productCode
    );
    // Default deny: a missing, inactive or zero entitlement means the plan
    // does not include the feature.
    if (!row || !row.is_active || !isBooleanEntitlementEnabled(row)) {
      throw new EntitlementForbiddenError(message, {
        code: "ENTITLEMENT_FEATURE_DISABLED",
        productCode,
        featureKey,
      });
    }
  }

  /**
   * Consume entitlement, delegates to usageService for counter-based tracking.
   */
  async consume(
    tenantId: string,
    productCode: string,
    amount: number = 1
  ): Promise<void> {
    await usageService.consume(tenantId, productCode, amount);
  }

  /**
   * Release entitlement, delegates to usageService for counter-based tracking.
   */
  async release(
    tenantId: string,
    productCode: string,
    amount: number = 1
  ): Promise<void> {
    await usageService.release(tenantId, productCode, amount);
  }

  /**
   * Get USER-scoped products that the tenant is entitled to.
   * Used by the ProductLinker UI to show available products for content linking.
   */
  async getLinkableProducts(tenantId: string): Promise<LinkableProductDto[]> {
    const rows = await db
      .selectFrom("entitlements")
      .innerJoin("products", "products.code", "entitlements.product_code")
      .innerJoin("features", "features.id", "products.feature_id")
      .select([
        "products.code as product_code",
        "products.title as product_title",
        "products.constraint_type",
        "products.unit",
        "products.usage_scope",
        "products.usage_window",
        "features.key as feature_key",
        "features.name as feature_name",
        "entitlements.limit_value",
        "entitlements.is_unlimited",
      ])
      .where("entitlements.tenant_id", "=", tenantId)
      .where("entitlements.is_active", "=", true)
      .where("products.usage_scope", "=", "USER")
      .orderBy("features.key", "asc")
      .orderBy("products.code", "asc")
      .execute();

    // Deduplicate by product_code (in case of multiple entitlement sources)
    const seen = new Map<string, LinkableProductDto>();
    for (const row of rows) {
      if (!seen.has(row.product_code)) {
        seen.set(row.product_code, {
          product_code: row.product_code,
          product_title: row.product_title,
          constraint_type: row.constraint_type as string,
          unit: row.unit,
          usage_scope: row.usage_scope as string,
          usage_window: row.usage_window as string,
          feature_key: row.feature_key,
          feature_name: row.feature_name,
          limit_value: typeof row.limit_value === "string"
            ? Number.parseInt(row.limit_value, 10)
            : Number(row.limit_value ?? 0),
          is_unlimited: Boolean(row.is_unlimited),
        });
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Check capacity for a user-scoped product.
   * Looks up the product's usage_scope and usage_window, then delegates to usageService.
   *
   * - If the product's scope is TENANT → uses standard tenant-level checkCapacity.
   * - If the product's scope is USER → checks the per-user scoped counter.
   *
   * This is the primary entry point for product integrations (AI authoring and other add-on features).
   */
  async checkUserCapacity(
    tenantId: string,
    productCode: string,
    memberId: string,
    amount: number = 1
  ): Promise<CheckCapacityResult> {
    // Look up product's scope settings
    const product = await db
      .selectFrom("products")
      .select(["usage_scope", "usage_window"])
      .where("code", "=", productCode)
      .executeTakeFirst();

    // If product not found, fall back to default tenant check
    if (!product) {
      return this.checkCapacity(tenantId, productCode, amount);
    }

    const scopeType = (product.usage_scope as string) ?? "TENANT";
    const windowType = (product.usage_window as string) ?? "LIFETIME";

    if (scopeType === "TENANT") {
      // Tenant-scoped: use standard path
      return this.checkCapacity(tenantId, productCode, amount);
    }

    // User-scoped: check per-user counter
    const result = await usageService.checkCapacity(tenantId, productCode, amount, {
      scopeType: scopeType as "TENANT" | "USER",
      scopeId: memberId,
      windowType: windowType as "LIFETIME" | "MONTHLY" | "YEARLY",
    });

    return {
      allowed: result.allowed,
      currentUsed: result.currentUsed,
      limit: result.limit,
      isUnlimited: result.isUnlimited,
      remainingSlots: result.remainingSlots,
      warning: result.warning,
    };
  }
}

const entitlementsService = new EntitlementsService();
export default entitlementsService;

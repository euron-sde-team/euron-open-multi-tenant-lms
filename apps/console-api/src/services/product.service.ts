import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import featureRepository from "../repositories/feature.repository";
import productRepository from "../repositories/product.repository";
import {
  CreateProductRequest,
  ProductListResponse,
  ProductQueryParams,
  ProductResponse,
  UpdateProductRequest,
} from "../types/catalog.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

const VALID_CONSTRAINT_TYPES = ["BOOLEAN", "COUNT", "LIMIT"];
const VALID_USAGE_SCOPES = ["TENANT", "USER"];
const VALID_USAGE_WINDOWS = ["LIFETIME", "MONTHLY", "YEARLY", "DAILY"];

class ProductService {
  /**
   * Create a new product
   */
  async createProduct(
    data: CreateProductRequest,
    actor: AuditActor
  ): Promise<ProductResponse> {
    // Validate code format (lowercase letters, numbers, and underscores)
    if (!data.code || !/^[a-z][a-z0-9_]*$/.test(data.code)) {
      throw new BadRequestError(
        "Product code must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
      );
    }

    // Validate constraint type
    if (!data.constraint_type || !VALID_CONSTRAINT_TYPES.includes(data.constraint_type)) {
      throw new BadRequestError(
        `Constraint type must be one of: ${VALID_CONSTRAINT_TYPES.join(", ")}`
      );
    }

    // Validate usage_scope if provided
    if (data.usage_scope && !VALID_USAGE_SCOPES.includes(data.usage_scope)) {
      throw new BadRequestError(
        `Usage scope must be one of: ${VALID_USAGE_SCOPES.join(", ")}`
      );
    }

    // Validate usage_window if provided
    if (data.usage_window && !VALID_USAGE_WINDOWS.includes(data.usage_window)) {
      throw new BadRequestError(
        `Usage window must be one of: ${VALID_USAGE_WINDOWS.join(", ")}`
      );
    }

    // Check if code already exists (codes are globally unique)
    const codeExists = await productRepository.codeExists(data.code);
    if (codeExists) {
      throw new ConflictError("Product code already exists");
    }

    // Validate feature exists
    const feature = await featureRepository.findByIdWithApplication(data.feature_id);
    if (!feature) {
      throw new NotFoundError("Feature not found");
    }

    if (feature.is_deprecated) {
      throw new ForbiddenError("Cannot create product for deprecated feature");
    }

    // Create product
    const product = await productRepository.create({
      id: ulid(),
      feature_id: data.feature_id,
      code: data.code,
      title: data.title?.trim() ?? null,
      constraint_type: data.constraint_type,
      unit: data.unit?.trim() ?? null,
      is_hard_limit: data.is_hard_limit ?? true,
      usage_scope: data.usage_scope ?? "TENANT",
      usage_window: data.usage_window ?? "LIFETIME",
      created_at: new Date(),
    });

    await auditService.record({
      actor,
      action: "PRODUCT_CREATED",
      category: "PRODUCT",
      resourceId: product.id,
      resourceLabel: product.code,
      summary: `Created product ${product.code} under feature ${feature.key}`,
    });

    return {
      ...product,
      feature_key: feature.key,
      feature_name: feature.name ?? undefined,
      application_code: feature.application_code,
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string): Promise<ProductResponse> {
    const product = await productRepository.findByIdWithDetails(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return {
      ...product,
      feature_name: product.feature_name ?? undefined,
    };
  }

  /**
   * List all products (plan_version_count included via repository JOIN)
   */
  async listProducts(params: ProductQueryParams): Promise<ProductListResponse> {
    const limit = params.limit ?? 50;
    const page = params.page ?? 1;
    const offset = (page - 1) * limit;

    const [products, total] = await Promise.all([
      productRepository.findAll({
        feature_id: params.feature_id,
        application_id: params.application_id,
        constraint_type: params.constraint_type,
        is_hard_limit: params.is_hard_limit,
        search: params.search,
        limit,
        offset,
      }),
      productRepository.count({
        feature_id: params.feature_id,
        application_id: params.application_id,
        constraint_type: params.constraint_type,
        is_hard_limit: params.is_hard_limit,
        search: params.search,
      }),
    ]);

    return {
      products: products.map((p) => ({
        ...p,
        feature_name: p.feature_name ?? undefined,
      })),
      total,
    };
  }

  /**
   * List products by feature ID (plan_version_count included via repository JOIN)
   */
  async listProductsByFeature(featureId: string): Promise<ProductListResponse> {
    // Validate feature exists
    const feature = await featureRepository.findByIdWithApplication(featureId);
    if (!feature) {
      throw new NotFoundError("Feature not found");
    }

    // Use findAll with feature_id filter to get products with plan_version_count via JOIN
    const products = await productRepository.findAll({ feature_id: featureId });
    const total = products.length;

    return {
      products: products.map((p) => ({
        ...p,
        feature_name: p.feature_name ?? undefined,
      })),
      total,
    };
  }

  /**
   * Update a product
   */
  async updateProduct(
    id: string,
    data: UpdateProductRequest,
    actor: AuditActor
  ): Promise<ProductResponse> {
    const product = await productRepository.findByIdWithDetails(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    // Validate usage_scope if provided
    if (data.usage_scope && !VALID_USAGE_SCOPES.includes(data.usage_scope)) {
      throw new BadRequestError(
        `Usage scope must be one of: ${VALID_USAGE_SCOPES.join(", ")}`
      );
    }

    // Validate usage_window if provided
    if (data.usage_window && !VALID_USAGE_WINDOWS.includes(data.usage_window)) {
      throw new BadRequestError(
        `Usage window must be one of: ${VALID_USAGE_WINDOWS.join(", ")}`
      );
    }

    // Note: constraint_type and code cannot be changed after creation (immutable)
    const updatedProduct = await productRepository.update(id, {
      title: data.title === undefined ? undefined : (data.title?.trim() || null),
      unit: data.unit?.trim() ?? null,
      is_hard_limit: data.is_hard_limit,
      usage_scope: data.usage_scope,
      usage_window: data.usage_window,
    });

    if (!updatedProduct) {
      throw new NotFoundError("Product not found");
    }

    await auditService.record({
      actor,
      action: "PRODUCT_UPDATED",
      category: "PRODUCT",
      resourceId: updatedProduct.id,
      resourceLabel: updatedProduct.code,
      summary: `Updated product ${updatedProduct.code}`,
    });

    return {
      ...updatedProduct,
      feature_key: product.feature_key,
      feature_name: product.feature_name ?? undefined,
      application_code: product.application_code,
    };
  }
}

export default new ProductService();

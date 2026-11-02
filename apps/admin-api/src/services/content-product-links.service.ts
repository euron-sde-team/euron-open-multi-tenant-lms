import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import contentProductLinksRepository from "../repositories/content-product-links.repository";
import entitlementsRepository from "../repositories/entitlements.repository";
import coursesRepository from "../repositories/courses.repository";
import booksRepository from "../repositories/books.repository";
import bundlesRepository from "../repositories/bundles.repository";
import type {
  LinkableContentType,
  LinkedProductItem,
  LinkedProductsResponse,
} from "../types/content-product-link.type";

class ContentProductLinksService {
  /**
   * Get linked products for a content item, enriched with entitlement status.
   */
  async getLinkedProducts(
    tenantId: string,
    contentType: LinkableContentType,
    contentId: string
  ): Promise<LinkedProductsResponse> {
    // Validate content exists and belongs to tenant
    await this.validateContentOwnership(tenantId, contentType, contentId);

    // Fetch linked products with metadata
    const links = await contentProductLinksRepository.getByContent(
      tenantId,
      contentType,
      contentId
    );

    // Enrich with entitlement status
    const entitlements = await entitlementsRepository.findActiveByTenantId(tenantId);
    const entitlementMap = new Map(
      entitlements.map((e) => [e.product_code, e])
    );

    const linkedProducts: LinkedProductItem[] = links.map((link) => {
      const ent = entitlementMap.get(link.product_code);
      return {
        id: link.link_id,
        product_code: link.product_code,
        product_title: link.product_title,
        constraint_type: link.constraint_type,
        unit: link.unit,
        usage_scope: link.usage_scope,
        usage_window: link.usage_window,
        feature_key: link.feature_key,
        feature_name: link.feature_name,
        is_active: link.is_active,
        is_entitled: !!ent && Boolean(ent.is_active),
        entitlement: ent
          ? {
              limit_value: typeof ent.limit_value === "string"
                ? parseInt(ent.limit_value as unknown as string, 10)
                : Number(ent.limit_value ?? 0),
              is_unlimited: Boolean(ent.is_unlimited),
            }
          : undefined,
      };
    });

    return { linked_products: linkedProducts };
  }

  /**
   * Set (replace-all) linked products for a content item.
   * Validates content ownership and product codes before persisting.
   */
  async setLinkedProducts(
    tenantId: string,
    contentType: LinkableContentType,
    contentId: string,
    productCodes: string[]
  ): Promise<LinkedProductsResponse> {
    // Validate content exists and belongs to tenant
    await this.validateContentOwnership(tenantId, contentType, contentId);

    // Deduplicate
    const uniqueCodes = [...new Set(productCodes)].filter(Boolean);

    // If empty, clear all links and return
    if (uniqueCodes.length === 0) {
      await contentProductLinksRepository.setForContent(
        tenantId,
        contentType,
        contentId,
        []
      );
      return { linked_products: [] };
    }

    // Validate all product codes exist in the platform products table
    const productRows = await db
      .selectFrom("products")
      .select(["id", "code"])
      .where("code", "in", uniqueCodes)
      .execute();

    const foundCodes = new Set(productRows.map((r) => r.code));
    const invalidCodes = uniqueCodes.filter((c) => !foundCodes.has(c));
    if (invalidCodes.length > 0) {
      throw new BadRequestError(
        `Invalid product codes: ${invalidCodes.join(", ")}`
      );
    }

    // Build entries for the repository
    const entries = productRows
      .filter((r) => uniqueCodes.includes(r.code))
      .map((r) => ({
        product_id: r.id,
        product_code: r.code,
      }));

    // Persist
    await contentProductLinksRepository.setForContent(
      tenantId,
      contentType,
      contentId,
      entries
    );

    // Return the updated list with enrichment
    return this.getLinkedProducts(tenantId, contentType, contentId);
  }

  /**
   * Validate that the content item exists and belongs to the tenant.
   */
  private async validateContentOwnership(
    tenantId: string,
    contentType: LinkableContentType,
    contentId: string
  ): Promise<void> {
    switch (contentType) {
      case "COURSE": {
        const course = await coursesRepository.findById(contentId);
        if (!course || course.tenant_id !== tenantId) {
          throw new NotFoundError("Course not found");
        }
        break;
      }
      case "BOOK": {
        const book = await booksRepository.findById(contentId);
        if (!book || book.tenant_id !== tenantId) {
          throw new NotFoundError("Book not found");
        }
        break;
      }
      case "BUNDLE": {
        const bundle = await bundlesRepository.findById(contentId);
        if (!bundle || bundle.tenant_id !== tenantId) {
          throw new NotFoundError("Bundle not found");
        }
        break;
      }
    }
  }
}

export default new ContentProductLinksService();

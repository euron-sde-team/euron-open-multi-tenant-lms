/**
 * Testimonial service, handles listing approved testimonials and submitting new ones.
 */

import { ulid } from "ulid";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import * as testimonialsRepo from "../repositories/testimonials.repository";
import logger from "../utils/logger";

class TestimonialService {
  /**
   * List approved testimonials for a tenant with pagination.
   */
  async listApprovedTestimonials(
    tenantId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const result = await testimonialsRepo.findApprovedTestimonials(tenantId, options);

    return {
      testimonials: result.testimonials.map(testimonialsRepo.toTestimonialDto),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Submit a new testimonial as a member. Created with PENDING status for admin approval.
   * Checks testimonials_enabled entitlement before allowing submission.
   */
  async submitTestimonial(
    tenantId: string,
    memberId: string,
    data: {
      name?: string;
      text?: string;
      image_url?: string;
      social_links?: any;
      rating?: number;
    }
  ) {
    // Validate: at least name or text required
    if (!data.name?.trim() && !data.text?.trim()) {
      throw new BadRequestError("At least name or text is required for a testimonial");
    }

    // Validate rating if provided (1-5)
    if (data.rating !== undefined && data.rating !== null) {
      if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
        throw new BadRequestError("Rating must be an integer between 1 and 5");
      }
    }

    // Check entitlement: testimonials_enabled
    await this.ensureTestimonialsEnabled(tenantId);

    const now = new Date();
    const testimonial = await testimonialsRepo.createTestimonial({
      id: ulid(),
      tenant_id: tenantId,
      tenant_member_id: memberId,
      name: data.name?.trim() || "",
      text: data.text?.trim() || null,
      image_url: data.image_url || null,
      social_links: data.social_links || null,
      rating: data.rating ?? null,
      status: "PENDING",
      created_at: now,
      updated_at: now,
    });

    logger.info(
      `Testimonial submitted: id=${testimonial.id}, tenantId=${tenantId}, memberId=${memberId}`
    );

    return testimonial;
  }

  /**
   * Check that the tenant has testimonials_enabled entitlement active.
   * Throws ForbiddenError if not enabled.
   */
  private async ensureTestimonialsEnabled(tenantId: string): Promise<void> {
    const entitlement = await db
      .selectFrom("entitlements")
      .select(["id", "limit_value", "is_active"])
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", "testimonials_enabled")
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!entitlement || Number(entitlement.limit_value) < 1) {
      throw new ForbiddenError(
        "Testimonials are not enabled for this platform."
      );
    }
  }
}

export default new TestimonialService();

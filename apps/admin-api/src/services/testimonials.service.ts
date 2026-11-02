/* eslint-disable @typescript-eslint/no-explicit-any */
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import testimonialsRepository from "../repositories/testimonials.repository";
import entitlementsService from "./entitlements.service";
import { db } from "../db/connection";

function toTestimonialResponse(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantMemberId: row.tenant_member_id,
    name: row.name,
    text: row.text,
    imageUrl: row.image_url,
    socialLinks: row.social_links,
    rating: row.rating,
    status: row.status,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    memberName: row.member_name ?? null,
    memberEmail: row.member_email ?? null,
    memberAvatar: row.member_avatar ?? null,
  };
}

class TestimonialsService {
  private async resolveMemberByEmail(tenantId: string, email: string): Promise<string | null> {
    const member = await db
      .selectFrom("tenant_members")
      .select(["id"])
      .where("tenant_id", "=", tenantId)
      .where("email", "=", email.trim().toLowerCase())
      .executeTakeFirst();
    return member?.id ?? null;
  }

  async listTestimonials(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; status?: string }
  ) {
    const result = await testimonialsRepository.findByTenantId(tenantId, params);
    return {
      testimonials: result.rows.map(toTestimonialResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getTestimonialById(id: string, tenantId: string) {
    const row = await testimonialsRepository.findById(id);
    if (!row || row.tenant_id !== tenantId) {
      throw new NotFoundError("Testimonial not found");
    }
    return toTestimonialResponse(row);
  }

  async getStats(tenantId: string) {
    return testimonialsRepository.getStats(tenantId);
  }

  async createTestimonial(
    tenantId: string,
    data: {
      name?: string;
      text?: string | null;
      image_url?: string | null;
      social_links?: unknown | null;
      rating?: number | null;
      tenant_member_id?: string | null;
      member_email?: string | null;
      status?: string;
    }
  ) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestError("Name is required");
    }

    await entitlementsService.ensureBooleanEntitlement(
      tenantId,
      "testimonials_enabled",
      "testimonials",
      "Testimonials feature not enabled"
    );

    let memberId = data.tenant_member_id ?? null;
    if (!memberId && data.member_email?.trim()) {
      memberId = await this.resolveMemberByEmail(tenantId, data.member_email);
      if (!memberId) {
        throw new BadRequestError("No member found with that email");
      }
    }

    const now = new Date();
    const row = await testimonialsRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      tenant_member_id: memberId,
      name: data.name.trim(),
      text: data.text ?? null,
      image_url: data.image_url ?? null,
      social_links: data.social_links ?? null,
      rating: data.rating ?? null,
      status: data.status ?? "PENDING",
      created_at: now,
      updated_at: now,
    });

    return toTestimonialResponse(row);
  }

  async updateTestimonial(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      text?: string | null;
      image_url?: string | null;
      social_links?: unknown | null;
      rating?: number | null;
      tenant_member_id?: string | null;
      member_email?: string | null;
      status?: string;
    }
  ) {
    const existing = await testimonialsRepository.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new NotFoundError("Testimonial not found");
    }

    let memberId = data.tenant_member_id;
    if (memberId === undefined && data.member_email !== undefined) {
      if (data.member_email?.trim()) {
        memberId = await this.resolveMemberByEmail(tenantId, data.member_email);
        if (!memberId) {
          throw new BadRequestError("No member found with that email");
        }
      } else {
        memberId = null;
      }
    }

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.text !== undefined) updateData.text = data.text;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.social_links !== undefined) updateData.social_links = data.social_links;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (memberId !== undefined) updateData.tenant_member_id = memberId;
    if (data.status !== undefined) updateData.status = data.status;

    const row = await testimonialsRepository.update(id, updateData);
    if (!row) {
      throw new NotFoundError("Testimonial not found");
    }

    return toTestimonialResponse(row);
  }

  async deleteTestimonial(id: string, tenantId: string) {
    const existing = await testimonialsRepository.findById(id);
    if (!existing || existing.tenant_id !== tenantId) {
      throw new NotFoundError("Testimonial not found");
    }

    const deleted = await testimonialsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("Testimonial not found");
    }

    return true;
  }

  async updateStatus(id: string, tenantId: string, status: string) {
    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      throw new BadRequestError("Invalid status. Must be APPROVED, REJECTED, or PENDING");
    }

    const row = await testimonialsRepository.updateStatus(id, tenantId, status);
    if (!row) {
      throw new NotFoundError("Testimonial not found");
    }

    return toTestimonialResponse(row);
  }
}

const testimonialsService = new TestimonialsService();
export default testimonialsService;

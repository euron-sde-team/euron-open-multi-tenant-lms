/**
 * Repository for testimonials (read-only + submission).
 * learner-api reads approved testimonials; admin-api handles moderation.
 */

import { sql } from "kysely";
import { db } from "../db/connection";

// ─── Inline types (testimonials table not yet in generated Kysely types) ─────

export interface TestimonialRow {
  id: string;
  tenant_id: string;
  tenant_member_id: string | null;
  name: string;
  text: string | null;
  image_url: string | null;
  social_links: any;
  rating: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestimonialDto {
  id: string;
  name: string;
  text: string | null;
  imageUrl: string | null;
  socialLinks: any;
  rating: number | null;
  createdAt: Date;
  memberName: string | null;
  memberAvatar: string | null;
}

// ─── Mappers ────────────────────────────────────────────────────────────────

export function toTestimonialDto(
  row: TestimonialRow & { member_name?: string | null; member_avatar?: string | null }
): TestimonialDto {
  return {
    id: row.id,
    name: row.name,
    text: row.text,
    imageUrl: row.image_url,
    socialLinks: row.social_links,
    rating: row.rating,
    createdAt: row.created_at,
    memberName: row.member_name ?? null,
    memberAvatar: row.member_avatar ?? null,
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * List approved testimonials for a tenant with pagination.
 * Joins tenant_members to include member name and avatar.
 */
export async function findApprovedTestimonials(
  tenantId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  testimonials: Array<TestimonialRow & { member_name: string | null; member_avatar: string | null }>;
  total: number;
  page: number;
  limit: number;
}> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 12;
  const offset = (page - 1) * limit;

  // Count total approved testimonials
  const countResult = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count
    FROM testimonials
    WHERE tenant_id = ${tenantId}
      AND status = 'APPROVED'
  `.execute(db);

  const total =
    typeof countResult.rows[0]?.count === "string"
      ? parseInt(countResult.rows[0].count, 10)
      : Number(countResult.rows[0]?.count ?? 0);

  // Fetch approved testimonials with member info
  const rows = await sql<
    TestimonialRow & { member_name: string | null; member_avatar: string | null }
  >`
    SELECT
      t.id, t.tenant_id, t.tenant_member_id, t.name, t.text,
      t.image_url, t.social_links, t.rating, t.status,
      t.created_at, t.updated_at,
      tm.name AS member_name,
      tm.avatar_url AS member_avatar
    FROM testimonials t
    LEFT JOIN tenant_members tm
      ON tm.id = t.tenant_member_id
      AND tm.tenant_id = t.tenant_id
    WHERE t.tenant_id = ${tenantId}
      AND t.status = 'APPROVED'
    ORDER BY t.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `.execute(db);

  return { testimonials: rows.rows, total, page, limit };
}

/**
 * Create a new testimonial.
 */
export async function createTestimonial(data: {
  id: string;
  tenant_id: string;
  tenant_member_id: string | null;
  name: string;
  text: string | null;
  image_url: string | null;
  social_links: any;
  rating: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): Promise<TestimonialRow> {
  const result = await sql<TestimonialRow>`
    INSERT INTO testimonials (
      id, tenant_id, tenant_member_id, name, text,
      image_url, social_links, rating, status,
      created_at, updated_at
    ) VALUES (
      ${data.id}, ${data.tenant_id}, ${data.tenant_member_id}, ${data.name}, ${data.text},
      ${data.image_url}, ${data.social_links ? sql`${JSON.stringify(data.social_links)}::jsonb` : sql`NULL`},
      ${data.rating}, ${data.status},
      ${data.created_at}, ${data.updated_at}
    )
    RETURNING *
  `.execute(db);

  return result.rows[0]!;
}

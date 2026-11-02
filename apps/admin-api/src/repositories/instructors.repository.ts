import { ulid } from "ulid";
import { db } from "../db/connection";
import type { instructors, instructor_experiences, instructor_socials } from "../db/types";

export type InstructorRow = instructors;
export type InstructorExperienceRow = instructor_experiences;
export type InstructorSocialsRow = instructor_socials;

export interface InstructorsListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface InstructorsListResult {
  instructors: InstructorRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateInstructorInput {
  tenant_id: string;
  name: string;
  email?: string | null;
  bio?: string | null;
  expertise?: string | null;
}

export interface UpdateInstructorInput {
  name?: string;
  email?: string | null;
  bio?: string | null;
  expertise?: string | null;
  profile_url?: string | null;
}

export interface CreateExperienceInput {
  tenant_id: string;
  instructor_id: string;
  company: string;
  company_logo?: string | null;
  years: number;
  details?: string | null;
  sort_order?: number;
}

export interface UpdateExperienceInput {
  company?: string;
  company_logo?: string | null;
  years?: number;
  details?: string | null;
  sort_order?: number;
}

export interface UpsertSocialsInput {
  tenant_id: string;
  instructor_id: string;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  youtube_url?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
}

class InstructorsRepository {
  /* ------------------------------------------------------------------ */
  /*  Instructors CRUD                                                   */
  /* ------------------------------------------------------------------ */

  async findByTenantId(
    tenantId: string,
    params: InstructorsListParams = {}
  ): Promise<InstructorsListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("instructors")
      .select(db.fn.count<number>("instructors.id").as("count"))
      .where("instructors.tenant_id", "=", tenantId);

    let listQuery = db
      .selectFrom("instructors")
      .selectAll()
      .where("instructors.tenant_id", "=", tenantId);

    if (params.search) {
      const search = `%${params.search}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("instructors.name", "ilike", search),
          eb("instructors.email", "ilike", search),
          eb("instructors.expertise", "ilike", search),
        ])
      );
      listQuery = listQuery.where((eb) =>
        eb.or([
          eb("instructors.name", "ilike", search),
          eb("instructors.email", "ilike", search),
          eb("instructors.expertise", "ilike", search),
        ])
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("instructors.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      instructors: rows as unknown as InstructorRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<InstructorRow | null> {
    let query = db
      .selectFrom("instructors")
      .selectAll()
      .where("instructors.id", "=", id);

    if (tenantId) {
      query = query.where("instructors.tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as InstructorRow | null;
  }

  async create(data: CreateInstructorInput): Promise<InstructorRow> {
    const id = ulid();
    const now = new Date();
    const row = await db
      .insertInto("instructors")
      .values({
        id,
        tenant_id: data.tenant_id,
        name: data.name,
        email: data.email ?? null,
        bio: data.bio ?? null,
        expertise: data.expertise ?? null,
        profile_url: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as InstructorRow;
  }

  async update(id: string, data: UpdateInstructorInput, tenantId?: string): Promise<InstructorRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.expertise !== undefined) updateData.expertise = data.expertise;
    if (data.profile_url !== undefined) updateData.profile_url = data.profile_url;

    let query = db
      .updateTable("instructors")
      .set(updateData)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query
      .returningAll()
      .executeTakeFirst();
    return row as unknown as InstructorRow | null;
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    let query = db
      .deleteFrom("instructors")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Experiences                                                        */
  /* ------------------------------------------------------------------ */

  async findExperiencesByInstructorId(
    instructorId: string,
    tenantId?: string
  ): Promise<InstructorExperienceRow[]> {
    let query = db
      .selectFrom("instructor_experiences")
      .selectAll()
      .where("instructor_id", "=", instructorId);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const rows = await query
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .execute();
    return rows as unknown as InstructorExperienceRow[];
  }

  async findExperienceById(id: string, tenantId?: string): Promise<InstructorExperienceRow | null> {
    let query = db
      .selectFrom("instructor_experiences")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as InstructorExperienceRow | null;
  }

  async createExperience(data: CreateExperienceInput): Promise<InstructorExperienceRow> {
    const id = ulid();
    const now = new Date();
    const row = await db
      .insertInto("instructor_experiences")
      .values({
        id,
        tenant_id: data.tenant_id,
        instructor_id: data.instructor_id,
        company: data.company,
        company_logo: data.company_logo ?? null,
        years: data.years,
        details: data.details ?? null,
        sort_order: data.sort_order ?? 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as InstructorExperienceRow;
  }

  async updateExperience(
    id: string,
    data: UpdateExperienceInput,
    tenantId?: string
  ): Promise<InstructorExperienceRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.company !== undefined) updateData.company = data.company;
    if (data.company_logo !== undefined) updateData.company_logo = data.company_logo;
    if (data.years !== undefined) updateData.years = data.years;
    if (data.details !== undefined) updateData.details = data.details;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

    let query = db
      .updateTable("instructor_experiences")
      .set(updateData)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query
      .returningAll()
      .executeTakeFirst();
    return row as unknown as InstructorExperienceRow | null;
  }

  async deleteExperience(id: string, tenantId?: string): Promise<boolean> {
    let query = db
      .deleteFrom("instructor_experiences")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Socials (1:1)                                                      */
  /* ------------------------------------------------------------------ */

  async findSocialsByInstructorId(
    instructorId: string,
    tenantId?: string
  ): Promise<InstructorSocialsRow | null> {
    let query = db
      .selectFrom("instructor_socials")
      .selectAll()
      .where("instructor_id", "=", instructorId);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as InstructorSocialsRow | null;
  }

  async upsertSocials(data: UpsertSocialsInput): Promise<InstructorSocialsRow> {
    const existing = await this.findSocialsByInstructorId(data.instructor_id);
    const now = new Date();

    if (existing) {
      const updateData: Record<string, unknown> = { updated_at: now };
      if (data.linkedin_url !== undefined) updateData.linkedin_url = data.linkedin_url;
      if (data.twitter_url !== undefined) updateData.twitter_url = data.twitter_url;
      if (data.youtube_url !== undefined) updateData.youtube_url = data.youtube_url;
      if (data.github_url !== undefined) updateData.github_url = data.github_url;
      if (data.website_url !== undefined) updateData.website_url = data.website_url;
      if (data.facebook_url !== undefined) updateData.facebook_url = data.facebook_url;
      if (data.instagram_url !== undefined) updateData.instagram_url = data.instagram_url;

      const row = await db
        .updateTable("instructor_socials")
        .set(updateData)
        .where("id", "=", existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row as unknown as InstructorSocialsRow;
    }

    const id = ulid();
    const row = await db
      .insertInto("instructor_socials")
      .values({
        id,
        tenant_id: data.tenant_id,
        instructor_id: data.instructor_id,
        linkedin_url: data.linkedin_url ?? null,
        twitter_url: data.twitter_url ?? null,
        youtube_url: data.youtube_url ?? null,
        github_url: data.github_url ?? null,
        website_url: data.website_url ?? null,
        facebook_url: data.facebook_url ?? null,
        instagram_url: data.instagram_url ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as InstructorSocialsRow;
  }
}

const instructorsRepository = new InstructorsRepository();
export default instructorsRepository;

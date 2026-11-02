/**
 * Read-only instructor repository for end-user API.
 * Instructor data is managed via tenant admin, this repo only reads.
 */

import { db } from "../db/connection";

export interface InstructorListItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  expertise: string | null;
  profileUrl: string | null;
}

export interface InstructorListResult {
  instructors: InstructorListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface InstructorListParams {
  page?: number;
  limit?: number;
}

class InstructorRepository {
  async findByTenantId(
    tenantId: string,
    params: InstructorListParams = {}
  ): Promise<InstructorListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const countResult = await db
      .selectFrom("instructors")
      .select(db.fn.count<number>("instructors.id").as("count"))
      .where("instructors.tenant_id", "=", tenantId)
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .selectFrom("instructors")
      .innerJoin("tenant_users", "tenant_users.id", "instructors.user_id")
      .select([
        "instructors.id",
        "instructors.bio",
        "instructors.expertise",
        "instructors.profile_url",
        "tenant_users.name",
        "tenant_users.email",
        "tenant_users.avatar_url",
      ])
      .where("instructors.tenant_id", "=", tenantId)
      .orderBy("instructors.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const totalPages = Math.ceil(total / limit);

    return {
      instructors: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url ?? null,
        bio: r.bio ?? null,
        expertise: r.expertise ?? null,
        profileUrl: r.profile_url ?? null,
      })),
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async findByIdAndTenant(
    id: string,
    tenantId: string
  ): Promise<InstructorListItem | null> {
    const row = await db
      .selectFrom("instructors")
      .innerJoin("tenant_users", "tenant_users.id", "instructors.user_id")
      .select([
        "instructors.id",
        "instructors.bio",
        "instructors.expertise",
        "instructors.profile_url",
        "tenant_users.name",
        "tenant_users.email",
        "tenant_users.avatar_url",
      ])
      .where("instructors.id", "=", id)
      .where("instructors.tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url ?? null,
      bio: row.bio ?? null,
      expertise: row.expertise ?? null,
      profileUrl: row.profile_url ?? null,
    };
  }

  async findExperiencesByInstructorId(instructorId: string) {
    const rows = await db
      .selectFrom("instructor_experiences")
      .select([
        "id",
        "company",
        "company_logo",
        "years",
        "details",
        "sort_order",
      ])
      .where("instructor_id", "=", instructorId)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      company: r.company,
      companyLogo: r.company_logo ?? null,
      years: r.years,
      details: r.details ?? null,
      sortOrder: r.sort_order,
    }));
  }

  async findSocialsByInstructorId(instructorId: string) {
    const row = await db
      .selectFrom("instructor_socials")
      .select([
        "linkedin_url",
        "twitter_url",
        "youtube_url",
        "github_url",
        "website_url",
        "facebook_url",
        "instagram_url",
      ])
      .where("instructor_id", "=", instructorId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      linkedinUrl: row.linkedin_url ?? null,
      twitterUrl: row.twitter_url ?? null,
      youtubeUrl: row.youtube_url ?? null,
      githubUrl: row.github_url ?? null,
      websiteUrl: row.website_url ?? null,
      facebookUrl: row.facebook_url ?? null,
      instagramUrl: row.instagram_url ?? null,
    };
  }

  async findInstructorsByCourseId(tenantId: string, courseId: string) {
    const rows = await db
      .selectFrom("course_instructors")
      .innerJoin("instructors", "instructors.id", "course_instructors.instructor_id")
      .leftJoin("instructor_socials", "instructor_socials.instructor_id", "course_instructors.instructor_id")
      .select([
        "course_instructors.id",
        "course_instructors.instructor_id",
        "instructors.name",
        "instructors.bio",
        "instructors.expertise",
        "instructors.profile_url",
        "course_instructors.sort_order",
        "instructor_socials.linkedin_url",
        "instructor_socials.twitter_url",
        "instructor_socials.github_url",
        "instructor_socials.youtube_url",
        "instructor_socials.website_url",
        "instructor_socials.facebook_url",
        "instructor_socials.instagram_url",
      ])
      .where("course_instructors.tenant_id", "=", tenantId)
      .where("course_instructors.course_id", "=", courseId)
      .orderBy("course_instructors.sort_order", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      instructorId: r.instructor_id,
      name: r.name,
      bio: r.bio ?? null,
      expertise: r.expertise ?? null,
      profileUrl: r.profile_url ?? null,
      sortOrder: typeof r.sort_order === "string" ? parseInt(r.sort_order, 10) : Number(r.sort_order ?? 0),
      socials: {
        linkedinUrl: r.linkedin_url ?? null,
        twitterUrl: r.twitter_url ?? null,
        githubUrl: r.github_url ?? null,
        youtubeUrl: r.youtube_url ?? null,
        websiteUrl: r.website_url ?? null,
        facebookUrl: r.facebook_url ?? null,
        instagramUrl: r.instagram_url ?? null,
      },
    }));
  }

  async findExperiencesByCourseId(tenantId: string, courseId: string) {
    const rows = await db
      .selectFrom("instructor_experiences")
      .innerJoin(
        "course_instructors",
        "course_instructors.instructor_id",
        "instructor_experiences.instructor_id"
      )
      .select([
        "instructor_experiences.instructor_id",
        "instructor_experiences.company",
        "instructor_experiences.company_logo",
        "instructor_experiences.years",
        "instructor_experiences.details",
        "instructor_experiences.sort_order",
      ])
      .where("course_instructors.tenant_id", "=", tenantId)
      .where("course_instructors.course_id", "=", courseId)
      .orderBy("instructor_experiences.sort_order", "asc")
      .orderBy("instructor_experiences.created_at", "desc")
      .execute();

    return rows.map((r) => ({
      instructorId: r.instructor_id,
      company: r.company,
      companyLogo: r.company_logo ?? null,
      years: r.years,
      details: r.details ?? null,
      sortOrder: typeof r.sort_order === "string" ? parseInt(r.sort_order, 10) : Number(r.sort_order ?? 0),
    }));
  }

  async findExperiencesByBookId(tenantId: string, bookId: string) {
    const rows = await db
      .selectFrom("instructor_experiences")
      .innerJoin(
        "book_authors",
        "book_authors.instructor_id",
        "instructor_experiences.instructor_id"
      )
      .select([
        "instructor_experiences.instructor_id",
        "instructor_experiences.company",
        "instructor_experiences.company_logo",
        "instructor_experiences.years",
        "instructor_experiences.details",
        "instructor_experiences.sort_order",
      ])
      .where("book_authors.tenant_id", "=", tenantId)
      .where("book_authors.book_id", "=", bookId)
      .orderBy("instructor_experiences.sort_order", "asc")
      .orderBy("instructor_experiences.created_at", "desc")
      .execute();

    return rows.map((r) => ({
      instructorId: r.instructor_id,
      company: r.company,
      companyLogo: r.company_logo ?? null,
      years: r.years,
      details: r.details ?? null,
      sortOrder: typeof r.sort_order === "string" ? parseInt(r.sort_order, 10) : Number(r.sort_order ?? 0),
    }));
  }

  async findCoursesByInstructorId(tenantId: string, instructorId: string) {
    const rows = await db
      .selectFrom("course_instructors")
      .innerJoin("courses", "courses.id", "course_instructors.course_id")
      .select([
        "courses.id",
        "courses.title",
        "courses.slug",
        "courses.subtitle",
        "courses.thumbnail_key",
        "courses.mode",
        "courses.purchase_mode",
        "courses.price_inr",
        "courses.price_usd",
        "courses.discount_inr",
        "courses.discount_usd",
        "courses.difficulty",
        "courses.language",
        "courses.course_type",
      ])
      .where("course_instructors.tenant_id", "=", tenantId)
      .where("course_instructors.instructor_id", "=", instructorId)
      .where("courses.status", "=", "PUBLISHED")
      .orderBy("course_instructors.sort_order", "asc")
      .execute();

    return rows;
  }

  async findBooksByInstructorId(tenantId: string, instructorId: string) {
    const rows = await db
      .selectFrom("book_authors")
      .innerJoin("books", "books.id", "book_authors.book_id")
      .select([
        "books.id",
        "books.title",
        "books.slug",
        "books.description",
        "books.thumbnail_url",
        "books.purchase_mode",
        "books.price_inr",
        "books.price_usd",
        "books.discount_inr",
        "books.discount_usd",
        "books.language",
      ])
      .where("book_authors.tenant_id", "=", tenantId)
      .where("book_authors.instructor_id", "=", instructorId)
      .where("books.status", "=", "PUBLISHED")
      .orderBy("book_authors.sort_order", "asc")
      .execute();

    return rows;
  }
}

const instructorRepository = new InstructorRepository();
export default instructorRepository;

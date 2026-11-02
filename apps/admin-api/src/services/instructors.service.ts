import sharp from "sharp";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import instructorsRepository, {
  type InstructorRow,
  type InstructorExperienceRow,
  type InstructorSocialsRow,
  type InstructorsListParams,
} from "../repositories/instructors.repository";
import entitlementsService from "./entitlements.service";
import tenantOrgS3Service from "./tenant-org.s3.service";
import usageService from "./usage.service";

/* ------------------------------------------------------------------ */
/*  Image optimization                                                 */
/* ------------------------------------------------------------------ */

const MAX_WIDTH = 1920;
const QUALITY = 80;

async function optimizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
  if (mimeType === "image/svg+xml") {
    return { buffer, ext: "svg", contentType: mimeType };
  }
  const metadata = await sharp(buffer).metadata();
  let pipeline = sharp(buffer).rotate();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const optimized = await pipeline.webp({ quality: QUALITY }).toBuffer();
  return { buffer: optimized, ext: "webp", contentType: "image/webp" };
}

/* ------------------------------------------------------------------ */
/*  Response DTOs                                                      */
/* ------------------------------------------------------------------ */

export interface InstructorResponse {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  bio: string | null;
  expertise: string | null;
  profileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorsListResponse {
  instructors: InstructorResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ExperienceResponse {
  id: string;
  instructorId: string;
  company: string;
  companyLogo: string | null;
  years: number;
  details: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocialsResponse {
  id: string;
  instructorId: string;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

/* ------------------------------------------------------------------ */
/*  Mappers                                                            */
/* ------------------------------------------------------------------ */

function resolveS3Url(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return tenantOrgS3Service.getPublicUrl(value);
}

function toInstructorResponse(row: InstructorRow): InstructorResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    bio: row.bio,
    expertise: row.expertise,
    profileUrl: resolveS3Url(row.profile_url),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function toExperienceResponse(row: InstructorExperienceRow): ExperienceResponse {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    company: row.company,
    companyLogo: resolveS3Url(row.company_logo),
    years: row.years,
    details: row.details,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function toSocialsResponse(row: InstructorSocialsRow): SocialsResponse {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    linkedinUrl: row.linkedin_url,
    twitterUrl: row.twitter_url,
    youtubeUrl: row.youtube_url,
    githubUrl: row.github_url,
    websiteUrl: row.website_url,
    facebookUrl: row.facebook_url,
    instagramUrl: row.instagram_url,
  };
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class InstructorsService {
  /* ---- Instructors ---- */

  async getInstructors(
    tenantId: string,
    params: InstructorsListParams
  ): Promise<InstructorsListResponse> {
    const result = await instructorsRepository.findByTenantId(tenantId, params);
    return {
      ...result,
      instructors: result.instructors.map(toInstructorResponse),
    };
  }

  async getInstructorById(
    instructorId: string,
    tenantId: string
  ): Promise<InstructorResponse> {
    const row = await instructorsRepository.findById(instructorId);
    if (!row) throw new NotFoundError("Instructor not found");
    if (row.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this instructor");
    }
    return toInstructorResponse(row);
  }

  async createInstructor(
    tenantId: string,
    data: { name: string; email?: string | null; bio?: string | null; expertise?: string | null }
  ): Promise<InstructorResponse> {
    // Entitlement: check instructors_count capacity
    const capacity = await entitlementsService.checkCapacity(tenantId, "instructors_count", 1);
    if (!capacity.allowed) {
      throw new EntitlementForbiddenError(
        "Instructor limit reached. Upgrade your plan to add more instructors.",
        {
          code: "ENTITLEMENT_LIMIT_REACHED",
          productCode: "instructors_count",
          featureKey: "instructors",
          currentUsed: capacity.currentUsed,
          limit: capacity.limit,
          isUnlimited: capacity.isUnlimited,
        }
      );
    }

    const row = await instructorsRepository.create({
      tenant_id: tenantId,
      name: data.name,
      email: data.email,
      bio: data.bio,
      expertise: data.expertise,
    });

    // Consume via usage counter
    await usageService.consume(tenantId, "instructors_count", 1, {
      resourceType: "INSTRUCTOR",
      resourceId: row.id,
    });

    return toInstructorResponse(row);
  }

  async updateInstructor(
    instructorId: string,
    tenantId: string,
    data: { name?: string; email?: string | null; bio?: string | null; expertise?: string | null }
  ): Promise<InstructorResponse> {
    const existing = await instructorsRepository.findById(instructorId);
    if (!existing) throw new NotFoundError("Instructor not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this instructor");
    }

    const updated = await instructorsRepository.update(instructorId, data);
    if (!updated) throw new NotFoundError("Instructor not found");
    return toInstructorResponse(updated);
  }

  async deleteInstructor(instructorId: string, tenantId: string): Promise<void> {
    const existing = await instructorsRepository.findById(instructorId);
    if (!existing) throw new NotFoundError("Instructor not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this instructor");
    }

    // Clean up S3 profile photo if exists
    if (existing.profile_url && !existing.profile_url.startsWith("http")) {
      try { await tenantOrgS3Service.deleteFile(existing.profile_url); } catch { /* best-effort */ }
    }

    const deleted = await instructorsRepository.delete(instructorId);
    if (!deleted) throw new NotFoundError("Instructor not found");

    // Release via usage counter
    await usageService.release(tenantId, "instructors_count", 1, {
      resourceType: "INSTRUCTOR",
      resourceId: instructorId,
    });
  }

  /* ---- Photo Upload/Delete ---- */

  async uploadProfilePhoto(
    tenantId: string,
    instructorId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ key: string; url: string }> {
    const existing = await instructorsRepository.findById(instructorId);
    if (!existing) throw new NotFoundError("Instructor not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this instructor");
    }

    const { buffer, ext, contentType } = await optimizeImage(fileBuffer, mimeType);
    const fileName = `instructors/${instructorId}/profile_${ulid()}.${ext}`;
    const key = await tenantOrgS3Service.uploadFile(tenantId, fileName, buffer, contentType);

    // Delete old photo from S3 if exists
    if (existing.profile_url && !existing.profile_url.startsWith("http")) {
      try { await tenantOrgS3Service.deleteFile(existing.profile_url); } catch { /* best-effort */ }
    }

    await instructorsRepository.update(instructorId, { profile_url: key });
    return { key, url: tenantOrgS3Service.getPublicUrl(key) };
  }

  async deleteProfilePhoto(tenantId: string, instructorId: string): Promise<void> {
    const existing = await instructorsRepository.findById(instructorId);
    if (!existing) throw new NotFoundError("Instructor not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this instructor");
    }
    if (!existing.profile_url) throw new BadRequestError("No profile photo to delete");

    if (!existing.profile_url.startsWith("http")) {
      await tenantOrgS3Service.deleteFile(existing.profile_url);
    }
    await instructorsRepository.update(instructorId, { profile_url: null });
  }

  async uploadCompanyLogo(
    tenantId: string,
    instructorId: string,
    experienceId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ key: string; url: string }> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const exp = await instructorsRepository.findExperienceById(experienceId);
    if (!exp || exp.instructor_id !== instructorId) {
      throw new NotFoundError("Experience not found");
    }

    const { buffer, ext, contentType } = await optimizeImage(fileBuffer, mimeType);
    const fileName = `instructors/${instructorId}/exp_${experienceId}_${ulid()}.${ext}`;
    const key = await tenantOrgS3Service.uploadFile(tenantId, fileName, buffer, contentType);

    // Delete old logo from S3 if exists
    if (exp.company_logo && !exp.company_logo.startsWith("http")) {
      try { await tenantOrgS3Service.deleteFile(exp.company_logo); } catch { /* best-effort */ }
    }

    await instructorsRepository.updateExperience(experienceId, { company_logo: key });
    return { key, url: tenantOrgS3Service.getPublicUrl(key) };
  }

  async deleteCompanyLogo(
    tenantId: string,
    instructorId: string,
    experienceId: string
  ): Promise<void> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const exp = await instructorsRepository.findExperienceById(experienceId);
    if (!exp || exp.instructor_id !== instructorId) {
      throw new NotFoundError("Experience not found");
    }
    if (!exp.company_logo) throw new BadRequestError("No company logo to delete");

    if (!exp.company_logo.startsWith("http")) {
      await tenantOrgS3Service.deleteFile(exp.company_logo);
    }
    await instructorsRepository.updateExperience(experienceId, { company_logo: null });
  }

  /* ---- Experiences ---- */

  async getExperiences(
    instructorId: string,
    tenantId: string
  ): Promise<ExperienceResponse[]> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const rows = await instructorsRepository.findExperiencesByInstructorId(instructorId);
    return rows.map(toExperienceResponse);
  }

  async createExperience(
    instructorId: string,
    tenantId: string,
    data: { company: string; company_logo?: string | null; years: number; details?: string | null; sort_order?: number }
  ): Promise<ExperienceResponse> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const row = await instructorsRepository.createExperience({
      tenant_id: tenantId,
      instructor_id: instructorId,
      ...data,
    });
    return toExperienceResponse(row);
  }

  async updateExperience(
    experienceId: string,
    instructorId: string,
    tenantId: string,
    data: { company?: string; company_logo?: string | null; years?: number; details?: string | null; sort_order?: number }
  ): Promise<ExperienceResponse> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const existing = await instructorsRepository.findExperienceById(experienceId);
    if (!existing || existing.instructor_id !== instructorId) {
      throw new NotFoundError("Experience not found");
    }
    const updated = await instructorsRepository.updateExperience(experienceId, data);
    if (!updated) throw new NotFoundError("Experience not found");
    return toExperienceResponse(updated);
  }

  async deleteExperience(
    experienceId: string,
    instructorId: string,
    tenantId: string
  ): Promise<void> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const existing = await instructorsRepository.findExperienceById(experienceId);
    if (!existing || existing.instructor_id !== instructorId) {
      throw new NotFoundError("Experience not found");
    }

    // Clean up S3 logo if exists
    if (existing.company_logo && !existing.company_logo.startsWith("http")) {
      try { await tenantOrgS3Service.deleteFile(existing.company_logo); } catch { /* best-effort */ }
    }

    await instructorsRepository.deleteExperience(experienceId);
  }

  /* ---- Socials ---- */

  async getSocials(
    instructorId: string,
    tenantId: string
  ): Promise<SocialsResponse | null> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const row = await instructorsRepository.findSocialsByInstructorId(instructorId);
    return row ? toSocialsResponse(row) : null;
  }

  async upsertSocials(
    instructorId: string,
    tenantId: string,
    data: {
      linkedin_url?: string | null;
      twitter_url?: string | null;
      youtube_url?: string | null;
      github_url?: string | null;
      website_url?: string | null;
      facebook_url?: string | null;
      instagram_url?: string | null;
    }
  ): Promise<SocialsResponse> {
    await this.getInstructorById(instructorId, tenantId); // ownership check
    const row = await instructorsRepository.upsertSocials({
      tenant_id: tenantId,
      instructor_id: instructorId,
      ...data,
    });
    return toSocialsResponse(row);
  }
}

const instructorsService = new InstructorsService();
export default instructorsService;

/**
 * Read-only instructor service for end-user API.
 */

import config from "../config";
import { NotFoundError } from "../errors/not-found.error";
import instructorRepository from "../repositories/instructor.repository";
import type { InstructorListParams } from "../repositories/instructor.repository";
import { getPriceMapsForEntities } from "../utils/price-resolver";

function resolveThumbnailUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  const base = config.THUMBNAILS_BASE_URL;
  if (!base) return key;
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  return `${base}/${cleanKey}`;
}

/** Resolve instructor profile_url (stored in tenant-details S3 bucket, not thumbnails). */
function resolveProfileUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  if (key.startsWith("http")) return key;
  const base = config.TENANT_DETAILS_BASE_URL;
  if (!base) return key;
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  return `${base}/${cleanKey}`;
}

class InstructorService {
  async listInstructors(tenantId: string, params: InstructorListParams = {}) {
    return instructorRepository.findByTenantId(tenantId, params);
  }

  async getInstructorsByCourseId(tenantId: string, courseId: string) {
    const [instructors, experienceRows] = await Promise.all([
      instructorRepository.findInstructorsByCourseId(tenantId, courseId),
      instructorRepository.findExperiencesByCourseId(tenantId, courseId),
    ]);

    // Group experiences by instructor_id
    const experienceMap = new Map<string, typeof experienceRows>();
    for (const exp of experienceRows) {
      const arr = experienceMap.get(exp.instructorId) || [];
      arr.push(exp);
      experienceMap.set(exp.instructorId, arr);
    }

    return instructors.map((i) => ({
      ...i,
      profileUrl: resolveProfileUrl(i.profileUrl),
      experiences: (experienceMap.get(i.instructorId) || []).map((e) => ({
        company: e.company,
        companyLogo: resolveProfileUrl(e.companyLogo),
        years: e.years,
        details: e.details,
      })),
    }));
  }

  async getInstructorDetail(tenantId: string, instructorId: string) {
    const instructor = await instructorRepository.findByIdAndTenant(
      instructorId,
      tenantId
    );
    if (!instructor) {
      throw new NotFoundError("Instructor not found");
    }

    const [experiences, socials, coursesRaw, booksRaw] = await Promise.all([
      instructorRepository.findExperiencesByInstructorId(instructorId),
      instructorRepository.findSocialsByInstructorId(instructorId),
      instructorRepository.findCoursesByInstructorId(tenantId, instructorId),
      instructorRepository.findBooksByInstructorId(tenantId, instructorId),
    ]);

    // Per-currency price maps (one batched call per entity type)
    const [coursePriceMaps, bookPriceMaps] = await Promise.all([
      getPriceMapsForEntities(tenantId, "COURSE", coursesRaw),
      getPriceMapsForEntities(tenantId, "BOOK", booksRaw),
    ]);

    const courses = coursesRaw.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      subtitle: c.subtitle ?? null,
      thumbnailUrl: resolveThumbnailUrl(c.thumbnail_key),
      mode: c.mode,
      purchaseMode: c.purchase_mode,
      priceInr: c.price_inr,
      priceUsd: c.price_usd,
      discountInr: c.discount_inr,
      discountUsd: c.discount_usd,
      prices: coursePriceMaps.get(c.id) ?? {},
      difficulty: c.difficulty,
      language: c.language ?? [],
      courseType: c.course_type,
    }));

    const books = booksRaw.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      description: b.description ?? null,
      thumbnailUrl: b.thumbnail_url ?? null,
      purchaseMode: b.purchase_mode,
      priceInr: b.price_inr,
      priceUsd: b.price_usd,
      discountInr: b.discount_inr,
      discountUsd: b.discount_usd,
      prices: bookPriceMaps.get(b.id) ?? {},
      language: b.language ?? [],
    }));

    return {
      ...instructor,
      experiences,
      socials,
      courses,
      books,
    };
  }
}

const instructorService = new InstructorService();
export default instructorService;

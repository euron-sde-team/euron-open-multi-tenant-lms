import { db } from "../db/connection";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import { listEvsVideos, normalizeVideoSource, type VideoProvider } from "./video-source.service";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import logger from "../utils/logger";

/**
 * Asset Library: lets tenant admins discover and reuse videos (EVS ids and
 * external links) already attached to lectures, across courses/sections/lessons.
 *
 * Tree shape returned to the frontend:
 *   courses[]: { id, title, slug, status, thumbnail, videoCount, updatedAt }
 *   (course expand) sections[] -> lessons[] -> lecture { videoId, duration, ... }
 *   unmapped[]: EVS library videos (when EVS is configured)
 */

export interface AssetCourseSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnailKey: string | null;
  updatedAt: Date;
  videoCount: number;
}

/** Video provider surfaced through the Asset Library so playback + attach branch. */
export type AssetVideoProvider = VideoProvider;

export interface AssetLectureNode {
  lectureId: string;
  lectureTitle: string;
  videoId: string;
  duration: string | null;
  processingStatus: string;
  reuseCount: number; // total lectures (in this tenant) using the same videoId
  provider: AssetVideoProvider;
}

export interface AssetLessonNode {
  lessonId: string;
  lessonTitle: string;
  sortOrder: number;
  isPreview: boolean;
  lecture: AssetLectureNode;
}

export interface AssetSectionNode {
  sectionId: string;
  sectionTitle: string;
  sortOrder: number;
  lessons: AssetLessonNode[];
}

export interface AssetCourseTree {
  courseId: string;
  sections: AssetSectionNode[];
}

export interface UnmappedAsset {
  videoId: string;
  sizeBytes: number;
  createdAt: Date;
  provider: AssetVideoProvider;
  /** Raw-seconds string (the format formatDuration accepts), or null. */
  duration: string | null;
}

export interface AssetSearchHit {
  videoId: string;
  lectureId: string;
  lectureTitle: string;
  lessonId: string;
  lessonTitle: string;
  sectionId: string;
  sectionTitle: string;
  courseId: string;
  courseTitle: string;
  duration: string | null;
  processingStatus: string;
  provider: AssetVideoProvider;
}

export interface ListCoursesFilters {
  search?: string;
  status?: "DRAFT" | "PUBLISHED";
  limit?: number;
  offset?: number;
}

/**
 * Page of courses that contain at least one lecture with a video.
 * Used for the top-level tree node list in the Asset Library picker.
 */
async function listCourses(
  tenantId: string,
  filters: ListCoursesFilters = {}
): Promise<{ items: AssetCourseSummary[]; nextOffset: number | null }> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;
  const rows = await courseLmsRepo.findCoursesWithVideos(tenantId, {
    search: filters.search,
    status: filters.status,
    limit: limit + 1, // fetch one extra to detect "has more"
    offset,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: slice.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      status: String(r.status),
      thumbnailKey: r.thumbnail_key ?? null,
      updatedAt: r.updated_at,
      videoCount: r.video_count,
    })),
    nextOffset: hasMore ? offset + limit : null,
  };
}

/**
 * Per-course tree: only branches with at least one video lecture.
 * Each lecture node carries a `reuseCount` (total lectures in this tenant
 * referencing the same videoId) so the picker can show "Used in N lessons".
 */
async function getCourseTree(
  tenantId: string,
  courseId: string
): Promise<AssetCourseTree> {
  const flat = await courseLmsRepo.findCourseAssetTree(tenantId, courseId);
  if (flat.length === 0) {
    return { courseId, sections: [] };
  }
  const distinctVideoKeys = Array.from(new Set(flat.map((r) => r.video_key)));
  const reuseMap = await courseLmsRepo.countLecturesByVideoKeys(
    tenantId,
    distinctVideoKeys
  );
  return { courseId, sections: groupFlatRowsIntoTree(flat, reuseMap) };
}

/**
 * Cross-course search by lecture/lesson/section/course title.
 * Returns a flat hit list (no tree assembly), best for search UX.
 */
async function searchAssets(
  tenantId: string,
  query: string,
  limit = 30
): Promise<AssetSearchHit[]> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];
  if (trimmed.length < 2) {
    throw new BadRequestError("Search query must be at least 2 characters");
  }
  const rows = await courseLmsRepo.searchAssets(tenantId, trimmed, limit);
  if (rows.length === 0) return [];
  // Hydrate the owning course for each hit (search rows carry lesson/section/
  // lecture context but not course id/title). One round-trip JOIN.
  const courseByLecture = await fetchCourseByLectureId(
    tenantId,
    rows.map((r) => r.lecture_id)
  );
  return rows.map((r) => {
    const course = courseByLecture.get(r.lecture_id);
    return {
      videoId: r.video_key,
      lectureId: r.lecture_id,
      lectureTitle: r.lecture_title,
      lessonId: r.lesson_id,
      lessonTitle: r.lesson_title,
      sectionId: r.section_id,
      sectionTitle: r.section_title,
      courseId: course?.id ?? "",
      courseTitle: course?.title ?? "",
      duration: r.lecture_duration,
      processingStatus: String(r.lecture_processing_status),
      provider: r.video_provider,
    };
  });
}

/**
 * Videos in the EVS library (empty when EVS is not configured). The admin
 * picks one to attach to a lecture; EVS owns sizes and posters.
 */
async function listUnmappedUploads(
  _tenantId: string,
  options: { withPosters?: boolean; limit?: number } = {}
): Promise<{ items: UnmappedAsset[]; posters?: Record<string, string | null> }> {
  const { items: videos } = await listEvsVideos({ limit: Math.min(options.limit ?? 50, 50) });
  const items: UnmappedAsset[] = videos.map((v) => ({
    videoId: v.id,
    sizeBytes: 0,
    createdAt: new Date(0),
    provider: "EVS",
    duration: v.durationSeconds != null && v.durationSeconds > 0 ? String(Math.floor(v.durationSeconds)) : null,
  }));
  if (!options.withPosters) return { items };
  const posters: Record<string, string | null> = {};
  for (const v of videos) posters[v.id] = v.posterUrl;
  return { items, posters };
}

/**
 * Preview-pane data for one video: which lectures use it + size + duration.
 * Used when the admin selects a video in the picker.
 */
async function getVideoUsage(
  tenantId: string,
  videoId: string
): Promise<{
  videoId: string;
  sizeBytes: number;
  reuseCount: number;
  usages: courseLmsRepo.VideoUsageRow[];
}> {
  const [reuseCount, usages] = await Promise.all([
    courseLmsRepo.countLecturesUsingVideoKey(tenantId, videoId),
    courseLmsRepo.findLecturesByVideoKey(tenantId, videoId),
  ]);
  return {
    videoId,
    sizeBytes: 0,
    reuseCount,
    usages,
  };
}

/**
 * Reuse-attach: bind an existing video to a target lecture.
 * - The video is either already used by a lecture in this tenant (its provider
 *   is reused) or is a valid EVS video id
 * - Updates the lecture in-place (video_provider, video_key) and inherits
 *   duration + summary from a source lecture when the destination is empty
 */
async function attachExistingVideoToLecture(
  tenantId: string,
  videoId: string,
  lectureId: string,
  _options: { copyTranscript?: boolean } = {}
): Promise<{
  lectureId: string;
  videoId: string;
  duration: string | null;
  transcriptCopied: boolean;
  summaryCopied: boolean;
}> {
  // 1. Target lecture must exist in this tenant
  const lecture = await courseLmsRepo.findLectureById(lectureId, tenantId);
  if (!lecture) {
    throw new NotFoundError("Destination lecture not found");
  }
  // 3. Source lecture lookup (any lecture using this videoId, excluding target)
  const source = await pickSourceLectureForVideo(tenantId, videoId, lectureId);
  const { provider, videoKey } = source?.video_provider
    ? { provider: source.video_provider as VideoProvider, videoKey: videoId }
    : normalizeVideoSource("EVS", videoId);

  // 2. Update the destination lecture
  const result = await db.transaction().execute(async (trx) => {
    const now = new Date();
    const newDuration =
      lecture.duration && lecture.duration.trim().length > 0
        ? lecture.duration
        : source?.duration ?? null;
    const newSummary =
      lecture.summary && lecture.summary.trim().length > 0
        ? lecture.summary
        : source?.summary ?? null;
    await trx
      .updateTable("lectures")
      .set({
        video_provider: provider,
        video_key: videoKey,
        duration: newDuration,
        summary: newSummary,
        updated_at: now,
      })
      .where("id", "=", lectureId)
      .where("tenant_id", "=", tenantId)
      .execute();
    const transcriptCopied = false;
    return {
      duration: newDuration,
      transcriptCopied,
      summaryCopied: newSummary !== lecture.summary && !!newSummary,
    };
  });

  logger.info(
    `[asset-library] attached video ${videoId} to lecture ${lectureId} (tenant ${tenantId}); transcriptCopied=${result.transcriptCopied}`
  );

  return {
    lectureId,
    videoId,
    duration: result.duration,
    transcriptCopied: result.transcriptCopied,
    summaryCopied: result.summaryCopied,
  };
}

// --- helpers ---

function groupFlatRowsIntoTree(
  rows: courseLmsRepo.AssetTreeFlatRow[],
  reuseMap: Map<string, number>
): AssetSectionNode[] {
  const sectionsById = new Map<string, AssetSectionNode>();
  for (const r of rows) {
    let section = sectionsById.get(r.section_id);
    if (!section) {
      section = {
        sectionId: r.section_id,
        sectionTitle: r.section_title,
        sortOrder: r.section_sort,
        lessons: [],
      };
      sectionsById.set(r.section_id, section);
    }
    section.lessons.push({
      lessonId: r.lesson_id,
      lessonTitle: r.lesson_title,
      sortOrder: r.lesson_sort,
      isPreview: r.lesson_is_preview,
      lecture: {
        lectureId: r.lecture_id,
        lectureTitle: r.lecture_title,
        videoId: r.video_key,
        duration: r.lecture_duration,
        processingStatus: String(r.lecture_processing_status),
        reuseCount: reuseMap.get(r.video_key) ?? 1,
        provider: r.video_provider,
      },
    });
  }
  // Already ordered by SQL; preserve order from input
  return Array.from(sectionsById.values());
}

async function pickSourceLectureForVideo(
  tenantId: string,
  videoId: string,
  excludeLectureId: string
): Promise<{
  id: string;
  duration: string | null;
  summary: string | null;
  video_provider: string | null;
} | null> {
  const row = await db
    .selectFrom("lectures")
    .select(["id", "duration", "summary", "video_provider"])
    .where("tenant_id", "=", tenantId)
    .where("video_key", "=", videoId)
    .where("id", "!=", excludeLectureId)
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

async function fetchCourseByLectureId(
  tenantId: string,
  lectureIds: string[]
): Promise<Map<string, { id: string; title: string }>> {
  const map = new Map<string, { id: string; title: string }>();
  if (lectureIds.length === 0) return map;
  const rows = await db
    .selectFrom("courses as c")
    .innerJoin("lectures as l", (j) =>
      j.onRef("l.course_id", "=", "c.id").onRef("l.tenant_id", "=", "c.tenant_id")
    )
    .select(["l.id as lecture_id", "c.id as course_id", "c.title as course_title"])
    .where("c.tenant_id", "=", tenantId)
    .where("l.id", "in", lectureIds)
    .execute();
  for (const row of rows) {
    map.set(row.lecture_id, { id: row.course_id, title: row.course_title });
  }
  return map;
}

export default {
  listCourses,
  getCourseTree,
  searchAssets,
  listUnmappedUploads,
  getVideoUsage,
  attachExistingVideoToLecture,
};

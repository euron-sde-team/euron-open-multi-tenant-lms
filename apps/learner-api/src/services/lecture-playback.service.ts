import config from "../config";
import { NotFoundError } from "../errors/not-found.error";
import { findLectureForPlayback } from "../repositories/courses.repository";
import courseService from "./course.service";
import { createPlaybackSession } from "./evs.client";

/**
 * What the player needs to start a video. EVS videos get a short-lived
 * session minted per viewer; external links (HLS, MP4, YouTube) are returned
 * as-is because they carry no secret, and the curriculum endpoint already
 * nulls `video_key` for anyone without access.
 */
export type LecturePlayback =
  | { provider: "EVS"; manifestUrl: string; token: string; expiresAt: string }
  | { provider: "HLS" | "MP4" | "YOUTUBE"; url: string };

const EXTERNAL_PROVIDERS = new Set(["HLS", "MP4", "YOUTUBE"]);

/**
 * Provider for a stored video when the row does not say. A URL is classified
 * by its shape; anything else is treated as an EVS video id.
 */
export function inferVideoProvider(videoKey: string): LecturePlayback["provider"] {
  const key = videoKey.trim();
  if (/^https?:\/\//i.test(key)) {
    if (/(^|\.)(youtube\.com|youtu\.be)\//i.test(key.replace(/^https?:\/\//i, ""))) return "YOUTUBE";
    if (/\.m3u8(\?|#|$)/i.test(key)) return "HLS";
    return "MP4";
  }
  return "EVS";
}

/** Build the playback payload for a video key and its (possibly unknown) provider. */
export async function playbackForVideo(
  videoKey: string,
  provider: string | null | undefined,
  viewerId: string,
  ttlSeconds: number = config.EVS_PLAYBACK_TTL_SECONDS
): Promise<LecturePlayback> {
  const resolved = (provider ?? "").toUpperCase() || inferVideoProvider(videoKey);
  if (EXTERNAL_PROVIDERS.has(resolved)) {
    return { provider: resolved as "HLS" | "MP4" | "YOUTUBE", url: videoKey };
  }
  const session = await createPlaybackSession(videoKey, { viewerId, ttlSeconds });
  return { provider: "EVS", ...session };
}

class LecturePlaybackService {
  /**
   * Playback for an enrolled member. Enrollment (and prerequisite locks) are
   * checked first; the video id is read from the lecture row of THIS course,
   * never taken from the client.
   */
  async forLecture(args: {
    tenantId: string;
    memberId: string;
    courseId: string;
    lectureId: string;
  }): Promise<LecturePlayback> {
    const { tenantId, memberId, courseId, lectureId } = args;
    await courseService.ensureEnrolled(tenantId, courseId, memberId);

    const lecture = await findLectureForPlayback(tenantId, courseId, lectureId);
    if (!lecture) throw new NotFoundError("Lecture not found");
    if (!lecture.video_key) throw new NotFoundError("This lecture has no video");

    return playbackForVideo(lecture.video_key, lecture.video_provider, `${tenantId}:${memberId}`);
  }
}

export default new LecturePlaybackService();

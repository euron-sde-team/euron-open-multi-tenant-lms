/**
 * Free course samples, played straight from the public course page.
 *
 * Deliberately unauthenticated: the visitor has not signed up yet, which is the
 * whole point. Whether a given video may be played is decided server side
 * against the course page that publishes it.
 */

import type { LMSVideoPlayback } from "@open-mtlms/lms-templates";

import { apiPost } from "./api-client";

/**
 * Same shape as the lecture playback route: an EVS session (tokenized HLS
 * manifest) or a direct HLS / MP4 / YouTube URL.
 */
export type CoursePreviewPlayback = LMSVideoPlayback & { title?: string };

/**
 * Mint playback for one sample. The server refuses anything not published as a
 * preview on that course, so a caller cannot reach paid content by guessing an
 * id.
 */
export async function getCoursePreviewPlayback(
  courseSlug: string,
  videoKey: string
): Promise<CoursePreviewPlayback> {
  return apiPost<CoursePreviewPlayback>(
    `/course-previews/${encodeURIComponent(courseSlug)}/playback`,
    { videoKey }
  );
}

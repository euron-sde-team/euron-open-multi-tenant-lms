"use client";

import { useEffect, useState } from "react";
import { applyVideoPlayback, type LMSLesson, type LMSSettings, type LMSVideoConfig } from "../types";

/**
 * Resolve the playable video for a lesson. YouTube plays straight from the
 * lesson data. EVS / HLS / MP4 lectures ask `settings.getVideoPlayback` (the
 * learner API playback route, which runs the enrollment check and reads the
 * video id from the lecture row), then render by the provider it returns.
 *
 * The resolved config belongs to the lesson it was fetched for: until the new
 * lesson's playback arrives, the lesson's own (unresolved) config is returned so
 * the player shows a loading state instead of crediting progress events from
 * the previous video to the new lesson.
 */
export function useLessonVideo(
  lesson: Pick<LMSLesson, "id" | "video">,
  settings: Pick<LMSSettings, "getVideoPlayback">
): LMSVideoConfig | undefined {
  const video = lesson.video;
  const [resolved, setResolved] = useState<{ lessonId: string; video: LMSVideoConfig } | null>(null);
  const getPlayback = settings.getVideoPlayback;
  const needsResolve =
    !!video &&
    !!video.videoId?.trim() &&
    video.provider !== "youtube" &&
    !video.hlsUrl &&
    !video.mp4Url;

  useEffect(() => {
    if (!video || !needsResolve || !getPlayback) return;
    let cancelled = false;
    getPlayback(lesson.id)
      .then((pb) => {
        if (!cancelled) setResolved({ lessonId: lesson.id, video: applyVideoPlayback(video, pb) });
      })
      .catch(() => {
        // Not enrolled or not ready yet: keep the unresolved config (loading state).
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, video?.videoId, video?.provider, needsResolve, getPlayback]);

  if (!video || !needsResolve) return video;
  return resolved && resolved.lessonId === lesson.id ? resolved.video : video;
}

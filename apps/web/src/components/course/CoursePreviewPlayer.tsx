"use client";

import { VideoPlayer, applyVideoPlayback } from "@open-mtlms/lms-templates";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getCoursePreviewPlayback,
  type CoursePreviewPlayback,
} from "@/lib/api/course-preview";

export interface PreviewRequest {
  videoKey: string;
  title: string;
}

/**
 * Plays a free course sample for a visitor who has not signed up.
 *
 * Picks the player from whatever the server returned (EVS / HLS / MP4 /
 * YouTube) rather than from anything the admin configured.
 */
export function CoursePreviewPlayer({
  courseSlug,
  request,
  onClose,
}: {
  courseSlug: string;
  request: PreviewRequest | null;
  onClose: () => void;
}) {
  const [playback, setPlayback] = useState<CoursePreviewPlayback | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      setPlayback(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPlayback(null);
    setError(null);
    getCoursePreviewPlayback(courseSlug, request.videoKey)
      .then((pb) => {
        if (!cancelled) setPlayback(pb);
      })
      .catch(() => {
        if (!cancelled) setError("This preview is not available right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [courseSlug, request]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!request) return;
    document.addEventListener("keydown", handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [request, handleKey]);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${request.title}`}
    >
      <div className="w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">
              Free preview
            </p>
            <h2 className="truncate text-lg font-semibold text-white">
              {request.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl bg-black">
          {error ? (
            <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/70">
              {error}
            </div>
          ) : !playback ? (
            <div className="flex aspect-video items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : (
            <VideoPlayer
              video={applyVideoPlayback({ provider: "evs", videoId: request.videoKey }, playback)}
              autoPlay
            />
          )}
        </div>
      </div>
    </div>
  );
}

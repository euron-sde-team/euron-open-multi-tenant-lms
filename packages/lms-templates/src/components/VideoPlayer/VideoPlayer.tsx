"use client";

import React from "react";
import { YouTubePlayer } from "./YouTubePlayer";
import { HlsPlayer } from "./hls/HlsPlayer";
import type { LMSVideoConfig } from "../../types";
import { cn } from "../../lib/utils";

interface VideoPlayerProps {
  /** Video configuration */
  video: LMSVideoConfig;
  /** Auto-play video on load */
  autoPlay?: boolean;
  /** Show player controls */
  controls?: boolean;
  /** Called when video ends */
  onEnded?: () => void;
  /** Called with current time periodically */
  onProgress?: (currentTime: number, duration: number) => void;
  /** Called when video starts playing */
  onPlay?: () => void;
  /** Called when video is paused */
  onPause?: () => void;
  /** Called when player is ready */
  onReady?: () => void;
  /** Called on error */
  onError?: (error: string | number) => void;
  /** Additional class name */
  className?: string;
  /** Aspect ratio (default: 16/9) */
  aspectRatio?: number;
  /** Start muted (for autoplay compliance) */
  muted?: boolean;
  /**
   * Sequential-learning lock. When true, the learner cannot seek forward past
   * the furthest point already watched in this lecture (`video.furthestWatched`
   * or the resume point, whichever is later; rewatching still allowed). The
   * HLS / MP4 player reverts synchronously; YouTube (sandboxed iframe) snaps back via the IFrame API
   * once its ~1 Hz poll reports the jump, so a brief skip is visible.
   */
  restrictForwardSeek?: boolean;
}

export function VideoPlayer({
  video,
  autoPlay = false,
  controls = true,
  onEnded,
  onProgress,
  onPlay,
  onPause,
  onReady,
  onError,
  className,
  aspectRatio = 16 / 9,
  muted,
  restrictForwardSeek,
}: VideoPlayerProps) {
  // No video: show same-size placeholder (global LMS standard UX)
  if (!video || !video.videoId?.trim()) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center border border-border/50",
          className
        )}
        style={{ aspectRatio }}
        role="img"
        aria-label="Video coming soon"
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="rounded-full bg-muted-foreground/10 p-4">
            <svg
              className="h-10 w-10 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-base sm:text-lg font-medium text-foreground">
            Video Coming Soon
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            This lesson doesn&apos;t have a video yet. Check back later or explore the overview and resources below.
          </p>
        </div>
      </div>
    );
  }

  // Render appropriate player based on provider
  if (video.provider === "youtube") {
    return (
      <YouTubePlayer
        videoId={video.videoId}
        startTime={video.startTime}
        furthestWatched={video.furthestWatched}
        autoPlay={autoPlay}
        controls={controls}
        onEnded={onEnded}
        onProgress={onProgress}
        onPlay={onPlay}
        onPause={onPause}
        onReady={onReady}
        onError={onError as (error: number) => void}
        restrictForwardSeek={restrictForwardSeek}
        className={className}
        aspectRatio={aspectRatio}
      />
    );
  }

  if (video.provider === "evs" || video.provider === "hls" || video.provider === "mp4") {
    // EVS ids are resolved to a tokenized manifest by the learner API after the
    // enrollment check. External HLS / MP4 links may be resolved the same way, or
    // passed straight through as the video id (admin preview).
    const isUrl = /^https?:\/\//i.test(video.videoId.trim());
    const hlsUrl =
      video.hlsUrl ?? (video.provider === "hls" && isUrl ? video.videoId.trim() : undefined);
    const mp4Url =
      video.mp4Url ?? (video.provider === "mp4" && isUrl ? video.videoId.trim() : undefined);

    if (!hlsUrl && !mp4Url) {
      return (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center",
            className
          )}
          style={{ aspectRatio }}
        >
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <svg
              className="h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-sm text-muted-foreground">
              Preparing video...
            </p>
          </div>
        </div>
      );
    }

    return (
      <HlsPlayer
        hlsUrl={hlsUrl}
        mp4Url={hlsUrl ? undefined : mp4Url}
        thumbnailsVttUrl={video.thumbnailsVttUrl}
        poster={video.posterUrl ?? video.thumbnail}
        watermarkText={video.watermarkText}
        autoPlay={autoPlay}
        muted={muted}
        startTime={video.startTime}
        furthestWatched={video.furthestWatched}
        onEnded={onEnded}
        onProgress={onProgress}
        onPlay={onPlay}
        onPause={onPause}
        onReady={onReady}
        onError={onError as (error: string) => void}
        className={className}
        aspectRatio={aspectRatio}
        restrictForwardSeek={restrictForwardSeek}
      />
    );
  }

  // Unknown provider
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center",
        className
      )}
      style={{ aspectRatio }}
    >
      <div className="flex flex-col items-center gap-2 text-center p-4">
        <svg
          className="h-12 w-12 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-muted-foreground">
          Unsupported video provider: {video.provider}
        </p>
      </div>
    </div>
  );
}

export default VideoPlayer;

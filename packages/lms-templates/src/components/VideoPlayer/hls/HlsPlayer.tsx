"use client";

import { cn } from "../../../lib/utils";
import { CorePlayer } from "./CorePlayer";

interface HlsPlayerProps {
  /** HLS master URL (a tokenized EVS session manifest or any external .m3u8). */
  hlsUrl?: string;
  /** Progressive MP4 URL, played through a native <video> when there is no hlsUrl. */
  mp4Url?: string;
  /** Scrub-preview WebVTT. */
  thumbnailsVttUrl?: string;
  poster?: string;
  watermarkText?: string;
  autoPlay?: boolean;
  muted?: boolean;
  startTime?: number;
  /**
   * Furthest point (seconds) already reached in this video on an earlier visit.
   * Seeds the forward-seek ceiling together with `startTime`, so a sequential
   * course never makes the learner re-watch what they already watched.
   */
  furthestWatched?: number;
  onEnded?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  /** Fired when the manifest or key fetch returns 401/403 (expired token). The
   * parent re-mints a fresh playback session, which remounts this player. */
  onKeyAuthRetry?: () => void;
  className?: string;
  aspectRatio?: number;
  /** Sequential-learning lock: block seeking forward past furthest watched. */
  restrictForwardSeek?: boolean;
}

/**
 * Generic HLS / MP4 player. Renders the custom control bar (quality picker +
 * ABR, scrub thumbnails, captions, keyboard shortcuts, PiP, fullscreen) over
 * hls.js on desktop/Android/iPad and native HLS on iPhone/iPod. MP4 sources play
 * through the same controls on a plain <video src>.
 */
export function HlsPlayer({
  hlsUrl,
  mp4Url,
  thumbnailsVttUrl,
  poster,
  watermarkText,
  startTime,
  furthestWatched,
  onEnded,
  onProgress,
  onPlay,
  onPause,
  onReady,
  onKeyAuthRetry,
  className,
  aspectRatio = 16 / 9,
  restrictForwardSeek,
}: HlsPlayerProps) {
  // Own the aspect-ratio box (w-full + style aspectRatio) and let CorePlayer
  // fill it absolutely, so the shape is the same however the slot sizes it.
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg bg-black", className)}
      style={{ aspectRatio }}
    >
      <CorePlayer
        source={{ hlsUrl, mp4Url, thumbnailsVttUrl }}
        poster={poster}
        watermarkText={watermarkText}
        startTime={startTime}
        furthestWatched={furthestWatched}
        restrictForwardSeek={restrictForwardSeek}
        onKeyAuthRetry={onKeyAuthRetry}
        onProgress={onProgress}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onReady={onReady}
      />
    </div>
  );
}

export default HlsPlayer;

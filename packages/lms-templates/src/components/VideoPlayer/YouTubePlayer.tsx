"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "../../lib/utils";

interface YouTubePlayerProps {
  /** YouTube video ID */
  videoId: string;
  /** Start time in seconds */
  startTime?: number;
  /**
   * Furthest point (seconds) already reached in this video on an earlier visit.
   * Seeds the forward-seek ceiling together with `startTime`, so a sequential
   * course never makes the learner re-watch what they already watched.
   */
  furthestWatched?: number;
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
  onError?: (error: number) => void;
  /** Additional class name */
  className?: string;
  /** Aspect ratio (default: 16/9) */
  aspectRatio?: number;
  /**
   * Sequential-learning lock, block seeking forward past the furthest point
   * already watched. YouTube is a sandboxed iframe, so we can only correct a
   * seek AFTER it happens (via the IFrame API `seekTo` command over
   * postMessage) once the ~1 Hz currentTime poll reports the jump. A brief
   * visible skip before the snap-back is unavoidable.
   */
  restrictForwardSeek?: boolean;
}

// YouTube reports currentTime at ~1 Hz, so a forward skip may show up a full
// second later; use a larger tolerance than the DRM players to avoid fighting
// normal playback jitter across that gap.
const YT_FORWARD_SEEK_EPSILON_S = 2.5;

/**
 * YouTube player using a standard iframe embed.
 * This avoids sizing issues from the YouTube IFrame API which injects
 * fixed pixel dimensions. A plain <iframe> with CSS width/height: 100%
 * fills its container reliably.
 */
export function YouTubePlayer({
  videoId,
  startTime = 0,
  furthestWatched = 0,
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
  restrictForwardSeek = false,
}: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Furthest legitimately-watched position (forward-seek ceiling). Advances
  // only on natural playback (small currentTime deltas); a forward skip is
  // reverted and never raises it. Refs so the message handler reads live
  // values without re-subscribing.
  const furthestWatchedRef = useRef(0);
  const restrictForwardSeekRef = useRef(restrictForwardSeek);
  useEffect(() => {
    restrictForwardSeekRef.current = restrictForwardSeek;
  }, [restrictForwardSeek]);
  // Seed the ceiling with what this video already had watched. The player is
  // reused across lessons, so a different video starts from its own mark
  // rather than inheriting the previous video's.
  const seededVideoRef = useRef<string | null>(null);
  useEffect(() => {
    const seed = Math.max(startTime, furthestWatched, 0);
    if (seededVideoRef.current !== videoId) {
      seededVideoRef.current = videoId;
      furthestWatchedRef.current = seed;
    } else if (seed > furthestWatchedRef.current) {
      furthestWatchedRef.current = seed;
    }
  }, [videoId, startTime, furthestWatched]);

  // Hold the latest progress callback in a ref so the message-handler effect
  // depends only on `videoId`, otherwise a parent re-render with a fresh
  // `onProgress` identity would tear down + re-attach the global "message"
  // listener on every render. Same trick for state callbacks below.
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);
  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Latest currentTime/duration reported by the YouTube iframe via the
  // `infoDelivery` event. We invoke `onProgress` whenever fresh values arrive.
  const latestCurrentTime = useRef<number | null>(null);
  const latestDuration = useRef<number | null>(null);

  // Build the embed URL with player parameters
  const buildEmbedUrl = useCallback(() => {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      autoplay: autoPlay ? "1" : "0",
      controls: controls ? "1" : "0",
      origin: typeof window !== "undefined" ? window.location.origin : "",
    });
    if (startTime > 0) {
      params.set("start", String(startTime));
    }
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, startTime, autoPlay, controls]);

  // Listen for YouTube postMessage events (state changes + infoDelivery for
  // current time / duration). We use refs for the callbacks so this effect's
  // deps stay scoped to `videoId`, otherwise callback identity churn would
  // tear down + re-attach the global window listener on every render.
  useEffect(() => {
    if (!videoId) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data.event === "onStateChange") {
          switch (data.info) {
            case 0: // ENDED
              onEndedRef.current?.();
              break;
            case 1: // PLAYING
              onPlayRef.current?.();
              break;
            case 2: // PAUSED
              onPauseRef.current?.();
              break;
          }
        }

        if (data.event === "onReady") {
          onReadyRef.current?.();
        }

        if (data.event === "onError") {
          setHasError(true);
          onErrorRef.current?.(data.info);
        }

        // YouTube's IFrame API answers `getCurrentTime` / `getDuration`
        // commands via an `infoDelivery` event with `info.currentTime` and
        // `info.duration` (and many other fields we don't care about here).
        // We cache the latest values and invoke `onProgress` once we have
        // both. The 1 Hz cadence below `useWatchTracker.PROGRESS_STALE_MS`
        // (2500 ms) keeps watch credit accruing normally.
        if (data.event === "infoDelivery" && data.info) {
          if (typeof data.info.currentTime === "number") {
            const ct = data.info.currentTime;

            // Sequential lock: if the position jumped past the furthest-watched
            // mark, snap back via the IFrame API. YouTube's iframe owns the
            // seek bar; we can only correct after the poll reports the jump.
            if (
              restrictForwardSeekRef.current &&
              ct > furthestWatchedRef.current + YT_FORWARD_SEEK_EPSILON_S
            ) {
              try {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({
                    event: "command",
                    func: "seekTo",
                    args: [furthestWatchedRef.current, true],
                  }),
                  "https://www.youtube.com"
                );
              } catch {
                /* cross-origin, ignore */
              }
              // Report the clamped position, don't advance the ceiling.
              latestCurrentTime.current = furthestWatchedRef.current;
            } else {
              latestCurrentTime.current = ct;
              if (ct > furthestWatchedRef.current) {
                furthestWatchedRef.current = ct;
              }
            }
          }
          if (typeof data.info.duration === "number" && data.info.duration > 0) {
            latestDuration.current = data.info.duration;
          }
          if (
            latestCurrentTime.current != null &&
            latestDuration.current != null
          ) {
            onProgressRef.current?.(
              latestCurrentTime.current,
              latestDuration.current
            );
          }
        }
      } catch {
        // Not a YouTube message or invalid JSON, ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [videoId]);

  // Drive the request loop that asks the iframe for currentTime/duration once
  // per second. Responses arrive on the message handler above. We don't gate
  // on `onProgress` here because the cost is two postMessage calls/sec, well
  // below noise, and gating on a callback identity would cause the same
  // listener-churn problem we just fixed.
  useEffect(() => {
    if (!iframeRef.current || isLoading) return;

    const iframe = iframeRef.current;
    const intervalId = setInterval(() => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime" }),
          "https://www.youtube.com"
        );
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "getDuration" }),
          "https://www.youtube.com"
        );
      } catch {
        // Cross-origin, ignore
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isLoading]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);

    // Tell the YouTube player to start listening for JS API events
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening" }),
        "https://www.youtube.com"
      );
    } catch {
      // ignore cross-origin
    }

    onReadyRef.current?.();
  }, []);

  const handleIframeError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onErrorRef.current?.(2);
  }, []);

  // Reset state + cached progress when videoId changes. Without clearing the
  // refs the new video would inherit the previous one's last reported time,
  // which `useWatchTracker` would then misread as a giant forward seek and
  // discard, silently dropping the first ~1s of credit on every switch.
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    latestCurrentTime.current = null;
    latestDuration.current = null;
  }, [videoId]);

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-black", className)}
      style={{ aspectRatio }}
    >
      {/* Loading State */}
      {isLoading && !hasError && (
        <div className="bg-black absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <span className="text-muted-foreground text-sm">Loading video...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="bg-muted absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <svg
              className="text-muted-foreground h-12 w-12"
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
            <p className="text-muted-foreground text-sm">Failed to load video. Please try again.</p>
          </div>
        </div>
      )}

      {/* YouTube iframe, fills the aspect-ratio container */}
      <iframe
        ref={iframeRef}
        src={buildEmbedUrl()}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />
    </div>
  );
}

export default YouTubePlayer;

"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ControlBar } from "./ControlBar";
import {
  CenterPlayButton,
  ErrorOverlay,
  OsdToast,
  ReplayOverlay,
  Spinner,
} from "./PlayerOverlays";
import { type PlayerSource, useHlsPlayer } from "./use-hls-player";
import { canPlayNativeHls, useNativeHls, useNativeTextTracks } from "./use-native-hls";
import { useControlsAutoHide } from "./useControlsAutoHide";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { usePlaybackState } from "./usePlaybackState";
import { usePlayerTracks } from "./usePlayerTracks";
import { useVttThumbnails } from "./useVttThumbnails";
import { Watermark } from "./Watermark";

// Adapted from the EVS reference player (VideoPlayer).
//  (renamed CorePlayer to avoid colliding with the
// provider-agnostic VideoPlayer wrapper). Adds optional callbacks + startTime so
// it conforms to the lms-templates player contract (progress tracking, resume).

type Orientation = "landscape" | "portrait" | "square";

interface Props {
  source: PlayerSource;
  poster?: string;
  orientation?: Orientation;
  watermarkText?: string;
  startTime?: number;
  /**
   * Furthest point (seconds) already reached in this video on an earlier visit.
   * Seeds the forward-seek ceiling together with `startTime`, so a sequential
   * course never makes the learner re-watch what they already watched.
   */
  furthestWatched?: number;
  /**
   * Sequential-learning lock: when true, the learner cannot seek forward past
   * the furthest point they've already watched in this lecture. Rewinding and
   * re-watching stay allowed. Enforced for every seek entry point (scrubber,
   * double-tap ±10s, keyboard) via a single `seeking` guard on the <video>.
   */
  restrictForwardSeek?: boolean;
  /** Called when the key endpoint rejects the token, so the parent can re-mint. */
  onKeyAuthRetry?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReady?: () => void;
}

// A forward seek is allowed to overshoot the furthest-watched mark by this many
// seconds before we snap it back, covers rounding + normal playback drift so
// natural play-through is never fought, only deliberate skips.
const FORWARD_SEEK_EPSILON_S = 1.5;

export function CorePlayer({
  source,
  poster,
  orientation = "landscape",
  watermarkText,
  startTime,
  furthestWatched,
  restrictForwardSeek = false,
  onKeyAuthRetry,
  onProgress,
  onEnded,
  onPlay,
  onPause,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Furthest position the learner has legitimately reached in THIS lecture,
  // used as the forward-seek ceiling. Advances only via natural playback (and
  // the resume seed below); a forward jump never raises it. Kept in a ref so
  // the seek guard reads the live value without re-subscribing.
  const furthestWatchedRef = useRef(0);
  const restrictRef = useRef(restrictForwardSeek);
  restrictRef.current = restrictForwardSeek;

  // Seed the ceiling with the furthest point reached on earlier visits (the
  // resume seed on load below covers `startTime`). Keyed on the stream without
  // its token, so a token re-mint for the same video keeps this visit's mark
  // while a different video starts from its own instead of the previous one's.
  const videoKey = (source.hlsUrl ?? source.mp4Url ?? "").split("?")[0];
  const seededVideoRef = useRef<string | null>(null);
  useEffect(() => {
    const seed = Math.max(furthestWatched ?? 0, 0);
    if (seededVideoRef.current !== videoKey) {
      seededVideoRef.current = videoKey;
      furthestWatchedRef.current = seed;
    } else if (seed > furthestWatchedRef.current) {
      furthestWatchedRef.current = seed;
    }
  }, [videoKey, furthestWatched]);

  // Pick the playback path: an MP4 source always plays through the native
  // <video src>; HLS uses native playback on iPhone/iPod and hls.js elsewhere.
  const isMp4 = !source.hlsUrl && Boolean(source.mp4Url);
  const goNative = useMemo(
    () => isMp4 || (canPlayNativeHls() && Boolean(source.hlsUrl)),
    [isMp4, source.hlsUrl]
  );
  const nativeUrl = isMp4 ? (source.mp4Url ?? null) : (source.hlsUrl ?? null);

  const {
    hls,
    isBuffering: hlsBuffering,
    error: hlsError,
    retry: hlsRetry,
  } = useHlsPlayer(videoRef, goNative ? null : source);
  const native = useNativeHls(videoRef, goNative ? nativeUrl : null);
  const nativeCaptions = useNativeTextTracks(videoRef, goNative);
  const vttTiles = useVttThumbnails(source.thumbnailsVttUrl ?? null);

  const error = goNative ? native.error : hlsError;
  const isBuffering = goNative ? native.isBuffering : hlsBuffering;

  const retry = useCallback(() => {
    if (goNative) videoRef.current?.load();
    else hlsRetry();
  }, [goNative, hlsRetry]);

  const state = usePlaybackState(videoRef);
  const { textTracks, textVisible } = usePlayerTracks(hls);

  const captionsAvailable = goNative ? nativeCaptions.available : textTracks.length > 0;
  const captionsOn = goNative ? nativeCaptions.on : textVisible;

  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [menuHover, setMenuHover] = useState(false);
  const [osd, setOsd] = useState<string | null>(null);

  const osdTimer = useRef<number | null>(null);
  const showOsd = useCallback((text: string) => {
    setOsd(text);
    if (osdTimer.current !== null) window.clearTimeout(osdTimer.current);
    osdTimer.current = window.setTimeout(() => setOsd(null), 700);
  }, []);

  // ── Forward raw <video> events to the lms wrapper callbacks + resume position ──
  const cbRef = useRef({ onProgress, onEnded, onPlay, onPause, onReady });
  cbRef.current = { onProgress, onEnded, onPlay, onPause, onReady };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (Number.isFinite(video.duration)) {
        // Natural playback advances the forward-seek ceiling. (A deliberate
        // forward jump lands here too, but the `seeking` guard reverts it
        // BEFORE any timeupdate fires at the jumped-to position, so the ceiling
        // never creeps forward from a skip.)
        if (video.currentTime > furthestWatchedRef.current) {
          furthestWatchedRef.current = video.currentTime;
        }
        cbRef.current.onProgress?.(video.currentTime, video.duration);
      }
    };
    // Guard: revert forward seeks past the furthest-watched mark. Fires for
    // every seek source (scrubber, ±10s double-tap, keyboard) since they all
    // ultimately set video.currentTime.
    const onSeeking = () => {
      if (!restrictRef.current) return;
      const ceiling = furthestWatchedRef.current + FORWARD_SEEK_EPSILON_S;
      if (video.currentTime > ceiling) {
        try {
          video.currentTime = furthestWatchedRef.current;
        } catch {
          /* seeking before metadata is non-fatal */
        }
      }
    };
    const onEndedH = () => cbRef.current.onEnded?.();
    const onPlayH = () => cbRef.current.onPlay?.();
    const onPauseH = () => cbRef.current.onPause?.();
    const onLoaded = () => {
      if (startTime && Number.isFinite(startTime) && startTime > 0) {
        try {
          video.currentTime = startTime;
        } catch {
          /* seek before metadata is non-fatal */
        }
        // Resume position is already "watched", seed the ceiling so the
        // learner can navigate freely within what they'd previously reached.
        furthestWatchedRef.current = Math.max(
          furthestWatchedRef.current,
          startTime
        );
      }
      cbRef.current.onReady?.();
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("ended", onEndedH);
    video.addEventListener("play", onPlayH);
    video.addEventListener("pause", onPauseH);
    video.addEventListener("loadedmetadata", onLoaded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("ended", onEndedH);
      video.removeEventListener("play", onPlayH);
      video.removeEventListener("pause", onPauseH);
      video.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [startTime, source.hlsUrl]);

  const { visible, nudge } = useControlsAutoHide(
    !state.paused,
    state.paused || scrubbing || menuHover
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, hls]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!hls) return;
    if (hls.subtitleTrack >= 0) {
      hls.subtitleTrack = -1;
      showOsd("Subtitles off");
    } else if ((hls.subtitleTracks?.length ?? 0) > 0) {
      hls.subtitleTrack = 0;
      hls.subtitleDisplay = true;
      showOsd("Subtitles on");
    }
  }, [hls, showOsd]);

  const onToggleCaptions = useCallback(() => {
    if (goNative) {
      showOsd(nativeCaptions.on ? "Subtitles off" : "Subtitles on");
      nativeCaptions.toggle();
    } else {
      toggleCaptions();
    }
  }, [goNative, nativeCaptions, toggleCaptions, showOsd]);

  useKeyboardShortcuts({
    videoRef,
    enabled: Boolean(hls) || goNative,
    onToggleFullscreen: toggleFullscreen,
    onToggleCaptions,
    showOsd,
  });

  const tapRef = useRef<{ time: number; x: number } | null>(null);
  const singleTimer = useRef<number | null>(null);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const onSurfaceClick = (e: React.MouseEvent) => {
    const now = performance.now();
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const width = rect?.width ?? 1;
    const prev = tapRef.current;

    if (prev && now - prev.time < 300) {
      if (singleTimer.current !== null) window.clearTimeout(singleTimer.current);
      tapRef.current = null;
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      if (isCoarse && x < width / 3) {
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, v.currentTime - 10);
        showOsd("⏪ 10s");
      } else if (isCoarse && x > (width * 2) / 3) {
        const v = videoRef.current;
        if (v) {
          const target = Math.min(v.duration || 0, v.currentTime + 10);
          // Sequential lock: don't skip past the furthest-watched mark.
          if (
            restrictRef.current &&
            target > furthestWatchedRef.current + FORWARD_SEEK_EPSILON_S
          ) {
            showOsd("🔒 Locked");
          } else {
            v.currentTime = target;
            showOsd("⏩ 10s");
          }
        }
      } else {
        toggleFullscreen();
      }
      return;
    }

    tapRef.current = { time: now, x };
    singleTimer.current = window.setTimeout(() => {
      togglePlay();
      tapRef.current = null;
    }, 260);
  };

  const showCenterPlay = state.paused && !state.ended && !isBuffering && !error;

  return (
    <div
      ref={containerRef}
      data-orientation={orientation}
      // The parent (HlsPlayer) owns the aspect-ratio box; this fills it.
      // Fullscreen escapes to the screen.
      className={clsx(
        "overflow-hidden bg-black",
        !isFullscreen && "absolute inset-0",
        isFullscreen && "flex h-screen w-screen items-center justify-center",
        visible ? "cursor-default" : "cursor-none"
      )}
      onPointerMove={nudge}
      onMouseLeave={() => !state.paused && nudge()}
      // Deterrent only: removes the casual "Save Video Frame As" menu.
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        className="h-full w-full bg-black object-contain"
        onClick={onSurfaceClick}
      />

      {watermarkText && <Watermark text={watermarkText} />}

      {isBuffering && !error && <Spinner />}
      {showCenterPlay && <CenterPlayButton onClick={togglePlay} />}
      {state.ended && !error && (
        <ReplayOverlay
          onClick={() => {
            const v = videoRef.current;
            if (v) {
              v.currentTime = 0;
              void v.play();
            }
          }}
        />
      )}
      <OsdToast text={osd} />

      {error && (
        <ErrorOverlay
          error={error}
          onRetry={() => (error.isKeyAuth && onKeyAuthRetry ? onKeyAuthRetry() : retry())}
        />
      )}

      <div
        className={clsx(
          "transition-opacity duration-200",
          visible || state.paused ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onPointerEnter={() => setMenuHover(true)}
        onPointerLeave={() => setMenuHover(false)}
      >
        {!error && (
          <ControlBar
            video={videoRef.current}
            hls={hls}
            state={state}
            vttTiles={vttTiles}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            captionsAvailable={captionsAvailable}
            captionsOn={captionsOn}
            onToggleCaptions={onToggleCaptions}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onScrubChange={setScrubbing}
          />
        )}
      </div>
    </div>
  );
}

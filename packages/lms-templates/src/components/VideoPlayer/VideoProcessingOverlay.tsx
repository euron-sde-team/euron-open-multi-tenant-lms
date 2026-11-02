"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const POLL_INTERVAL_MS = 10_000; // 10 seconds

interface VideoProcessingOverlayProps {
  videoId: string;
  /** Called when the video status becomes "ready" */
  onReady: () => void;
  /** Proxy function that calls the backend to check video status */
  checkStatus: (
    videoId: string
  ) => Promise<{ status: "ready" | "processing" | "error" }>;
  className?: string;
}

export function VideoProcessingOverlay({
  videoId,
  onReady,
  checkStatus,
  className,
}: VideoProcessingOverlayProps) {
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      try {
        const result = await checkStatus(videoId);
        if (!mountedRef.current) return;
        if (result.status === "ready") {
          if (timerRef.current) clearInterval(timerRef.current);
          onReady();
          return;
        }
      } catch {
        // Ignore errors, keep polling
      }
      if (mountedRef.current) setPollCount((c) => c + 1);
    };

    // Initial check
    poll();

    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [videoId, checkStatus, onReady]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center bg-black",
        className
      )}
      style={{ aspectRatio: "16/9" }}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />

      {/* Pulsing ring behind icon */}
      <div className="absolute h-24 w-24 animate-ping rounded-full bg-blue-500/10" style={{ animationDuration: "3s" }} />

      {/* Content card */}
      <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl bg-white/[0.07] px-10 py-8 text-center backdrop-blur-md">
        {/* Spinner */}
        <div className="relative">
          <div className="absolute -inset-2 animate-pulse rounded-full bg-blue-500/20" />
          <Loader2 className="relative h-10 w-10 animate-spin text-blue-400" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white">
          Processing Your Video
        </h3>

        {/* Subtitle */}
        <p className="max-w-xs text-sm leading-relaxed text-gray-400">
          Your video is being encoded and will be available shortly. This
          usually takes a few minutes.
        </p>

        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"
            style={{ animationDelay: "600ms" }}
          />
        </div>

        {/* Polling indicator (subtle) */}
        {pollCount > 0 && (
          <p className="text-xs text-gray-500">
            Checking status{pollCount > 1 ? ` (${pollCount})` : ""}...
          </p>
        )}
      </div>
    </div>
  );
}

export default VideoProcessingOverlay;

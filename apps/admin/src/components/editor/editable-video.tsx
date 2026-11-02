"use client";

import { parseVideoUrl } from "@open-mtlms/shared";
import type { VideoInfo } from "@open-mtlms/shared";
import { AlertCircle, Play, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { cn } from "@/lib/utils";

import { VideoPicker } from "./video-picker";

interface EditableVideoProps {
  url: string;
  onChange: (url: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  placeholder?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export function EditableVideo({
  url,
  onChange,
  className,
  aspectRatio = "video",
  placeholder = "Click to add video",
  autoplay = false,
  muted = true,
  loop = false,
  controls = true,
}: EditableVideoProps) {
  const isEditMode = useEditMode();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [hasError, setHasError] = useState(false);

  // Parse video URL when it changes
  useEffect(() => {
    if (url) {
      const info = parseVideoUrl(url);
      setVideoInfo(info);
      setHasError(!info.isValid);
    } else {
      setVideoInfo(null);
      setHasError(false);
    }
  }, [url]);

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    auto: "",
  }[aspectRatio];

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) {
      e.stopPropagation();
      setIsPickerOpen(true);
    }
  };

  const handleVideoSelect = (info: VideoInfo) => {
    onChange(info.url);
    setHasError(false);
  };

  // Render video player based on source
  const renderVideoPlayer = () => {
    if (!videoInfo || !videoInfo.isValid) {
      return null;
    }

    if (videoInfo.source === "youtube" || videoInfo.source === "vimeo") {
      // Build embed URL with parameters
      const embedUrl = videoInfo.embedUrl || "";
      const params = new URLSearchParams();

      if (videoInfo.source === "youtube") {
        if (autoplay) params.append("autoplay", "1");
        if (muted) params.append("mute", "1");
        if (loop) params.append("loop", "1");
        if (!controls) params.append("controls", "0");
        params.append("rel", "0"); // Don't show related videos
      } else if (videoInfo.source === "vimeo") {
        if (autoplay) params.append("autoplay", "1");
        if (muted) params.append("muted", "1");
        if (loop) params.append("loop", "1");
      }

      const separator = embedUrl.includes("?") ? "&" : "?";
      const finalUrl = params.toString()
        ? `${embedUrl}${separator}${params}`
        : embedUrl;

      return (
        <iframe
          src={finalUrl}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    // Direct video
    return (
      <video
        src={videoInfo.url}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay={autoplay}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        onError={() => setHasError(true)}
      >
        Your browser does not support the video tag.
      </video>
    );
  };

  // If not in edit mode, just render the video
  if (!isEditMode) {
    if (!url || !videoInfo?.isValid) {
      return null;
    }
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-black",
          aspectRatioClass,
          className
        )}
      >
        {renderVideoPlayer()}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-black transition-colors hover:border-primary/50",
          aspectRatioClass,
          className
        )}
        onClick={handleClick}
      >
        {url && videoInfo?.isValid && !hasError ? (
          <>
            {renderVideoPlayer()}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-2">
                <Video className="h-4 w-4" />
                <span className="text-sm font-medium">Change Video</span>
              </div>
            </div>
          </>
        ) : hasError ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-4 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm">Unable to load video</span>
            <span className="text-xs text-muted-foreground">Click to change</span>
          </div>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
            <div className="relative">
              <Video className="h-12 w-12" />
              <Play className="absolute bottom-0 right-0 h-5 w-5 translate-x-1 translate-y-1" />
            </div>
            <span className="text-sm">{placeholder}</span>
            <span className="text-xs">YouTube, Vimeo, or direct video URL</span>
          </div>
        )}
      </div>

      <VideoPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleVideoSelect}
        currentUrl={url}
      />
    </>
  );
}

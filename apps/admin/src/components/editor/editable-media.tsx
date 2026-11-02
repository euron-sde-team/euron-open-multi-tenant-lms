"use client";

import { Button } from "@open-mtlms/core";
import { parseVideoUrl } from "@open-mtlms/shared";
import type { MediaImage, VideoInfo } from "@open-mtlms/shared";
import {
  ImageIcon,
  ImagePlus,
  Play,
  Video,
  VideoIcon,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { cn } from "@/lib/utils";

import { ImagePicker } from "./image-picker";
import { VideoPicker } from "./video-picker";

interface EditableMediaProps {
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  onImageChange: (src: string, alt: string) => void;
  onVideoChange: (url: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  placeholder?: string;
  lockedAspectRatio?: string;
  recommendedAspectRatio?: string;
  sectionContext?: {
    sectionType?: string;
    headline?: string;
    description?: string;
    badge?: string;
  };
}

export function EditableMedia({
  image,
  imageAlt = "",
  videoUrl,
  onImageChange,
  onVideoChange,
  className,
  aspectRatio = "video",
  placeholder = "Click to add media",
  lockedAspectRatio,
  recommendedAspectRatio,
  sectionContext,
}: EditableMediaProps) {
  const isEditMode = useEditMode();
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isVideoPickerOpen, setIsVideoPickerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  // Parse video URL when it changes
  useEffect(() => {
    if (videoUrl) {
      const info = parseVideoUrl(videoUrl);
      setVideoInfo(info);
    } else {
      setVideoInfo(null);
      setIsPlaying(false);
    }
  }, [videoUrl]);

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    auto: "",
  }[aspectRatio];

  const handleImageSelect = (mediaImage: MediaImage) => {
    onImageChange(mediaImage.src, mediaImage.alt);
  };

  const handleVideoSelect = (info: VideoInfo) => {
    onVideoChange(info.url);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoInfo?.isValid) {
      setIsPlaying(true);
    }
  };

  const handleStopVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(false);
  };

  // Render video player
  const renderVideoPlayer = () => {
    if (!videoInfo || !videoInfo.isValid) return null;

    if (videoInfo.source === "youtube" || videoInfo.source === "vimeo") {
      const embedUrl = videoInfo.embedUrl || "";
      const params = new URLSearchParams();

      if (videoInfo.source === "youtube") {
        params.append("autoplay", "1");
        params.append("rel", "0");
      } else if (videoInfo.source === "vimeo") {
        params.append("autoplay", "1");
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
        autoPlay
        controls
        playsInline
      >
        Your browser does not support the video tag.
      </video>
    );
  };

  // Get YouTube thumbnail
  const getVideoThumbnail = () => {
    if (videoInfo?.source === "youtube" && videoInfo.videoId) {
      return `https://img.youtube.com/vi/${videoInfo.videoId}/maxresdefault.jpg`;
    }
    if (videoInfo?.source === "vimeo" && videoInfo.videoId) {
      return `https://vumbnail.com/${videoInfo.videoId}.jpg`;
    }
    return null;
  };

  const hasMedia = image || videoUrl;
  const thumbnailSrc = image || getVideoThumbnail();

  // Non-edit mode rendering
  if (!isEditMode) {
    if (!hasMedia) return null;

    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectRatioClass,
          className
        )}
      >
        {isPlaying && videoInfo?.isValid ? (
          renderVideoPlayer()
        ) : (
          <>
            {thumbnailSrc && (
              <Image
                src={thumbnailSrc}
                alt={imageAlt || "Media"}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            {videoUrl && videoInfo?.isValid && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-110">
                  <Play className="ml-1 h-8 w-8" fill="currentColor" />
                </div>
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Edit mode rendering
  return (
    <>
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted transition-colors hover:border-primary/50",
          aspectRatioClass,
          className
        )}
      >
        {isPlaying && videoInfo?.isValid ? (
          <>
            {renderVideoPlayer()}
            <button
              onClick={handleStopVideo}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : hasMedia ? (
          <>
            {thumbnailSrc && (
              <Image
                src={thumbnailSrc}
                alt={imageAlt || "Media"}
                fill
                className="object-cover"
                unoptimized
              />
            )}

            {/* Play button overlay when video exists */}
            {videoUrl && videoInfo?.isValid && !isPlaying && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-110">
                  <Play className="ml-1 h-8 w-8" fill="currentColor" />
                </div>
              </button>
            )}

            {/* Edit controls overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImagePickerOpen(true);
                  }}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  {image ? "Change Image" : "Add Image"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVideoPickerOpen(true);
                  }}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {videoUrl ? "Change Video" : "Add Video"}
                </Button>
                {(image || videoUrl) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (image) onImageChange("", "");
                      if (videoUrl) onVideoChange("");
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove All
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          // Empty state
          <div
            onClick={() => setIsImagePickerOpen(true)}
            className="flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center gap-4 p-4"
          >
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImagePlus className="h-10 w-10" />
                <span className="text-xs">Image</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <VideoIcon className="h-10 w-10" />
                <span className="text-xs">Video</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{placeholder}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsImagePickerOpen(true);
                }}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Image
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVideoPickerOpen(true);
                }}
              >
                <Video className="mr-2 h-4 w-4" />
                Add Video
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pickers */}
      <ImagePicker
        open={isImagePickerOpen}
        onOpenChange={setIsImagePickerOpen}
        onSelect={handleImageSelect}
        currentImage={image}
        currentAlt={imageAlt}
        lockedAspectRatio={lockedAspectRatio}
        recommendedAspectRatio={recommendedAspectRatio}
        sectionContext={sectionContext}
      />

      <VideoPicker
        open={isVideoPickerOpen}
        onOpenChange={setIsVideoPickerOpen}
        onSelect={handleVideoSelect}
        currentUrl={videoUrl}
      />
    </>
  );
}

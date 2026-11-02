"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import { parseVideoUrl } from "@open-mtlms/shared";
import type { VideoInfo } from "@open-mtlms/shared";
import {
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  Loader2,
  Play,
  Video,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface VideoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (videoInfo: VideoInfo) => void;
  currentUrl?: string;
}

export function VideoPicker({
  open,
  onOpenChange,
  onSelect,
  currentUrl = "",
}: VideoPickerProps) {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrlInput(currentUrl);
      if (currentUrl) {
        const info = parseVideoUrl(currentUrl);
        setVideoInfo(info);
        setShowPreview(info.isValid);
      } else {
        setVideoInfo(null);
        setShowPreview(false);
      }
    }
  }, [open, currentUrl]);

  // Validate URL with debounce
  const validateUrl = useCallback((url: string) => {
    if (!url.trim()) {
      setVideoInfo(null);
      setShowPreview(false);
      return;
    }

    setIsValidating(true);

    // Small delay to show loading state
    setTimeout(() => {
      const info = parseVideoUrl(url);
      setVideoInfo(info);
      setShowPreview(info.isValid);
      setIsValidating(false);
    }, 300);
  }, []);

  // Handle URL input change
  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    validateUrl(value);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (videoInfo?.isValid) {
      onSelect(videoInfo);
      onOpenChange(false);
    }
  };

  // Get source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case "youtube":
        return <Youtube className="h-4 w-4 text-red-500" />;
      case "vimeo":
        return <Video className="h-4 w-4 text-blue-500" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  // Get source label
  const getSourceLabel = (source: string) => {
    switch (source) {
      case "youtube":
        return "YouTube";
      case "vimeo":
        return "Vimeo";
      default:
        return "Direct Video";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="video-url">Video URL</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="video-url"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Paste YouTube, Vimeo, or direct video URL..."
                className="pl-9 pr-10"
              />
              {isValidating && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {!isValidating && videoInfo?.isValid && (
                <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
              )}
              {!isValidating && videoInfo && !videoInfo.isValid && urlInput && (
                <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
              )}
            </div>

            {/* Error Message */}
            {videoInfo && !videoInfo.isValid && urlInput && (
              <p className="text-sm text-destructive">{videoInfo.error}</p>
            )}

            {/* Supported Formats */}
            <p className="text-xs text-muted-foreground">
              Supported: YouTube, Vimeo, or direct video links (.mp4, .webm,
              .ogg)
            </p>
          </div>

          {/* Video Source Badge */}
          {videoInfo?.isValid && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              {getSourceIcon(videoInfo.source)}
              <span className="text-sm font-medium">
                {getSourceLabel(videoInfo.source)}
              </span>
              {videoInfo.videoId && (
                <span className="text-xs text-muted-foreground">
                  ID: {videoInfo.videoId}
                </span>
              )}
            </div>
          )}

          {/* Video Preview */}
          {showPreview && videoInfo?.isValid && (
            <div className="space-y-3">
              <Label>Preview</Label>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {videoInfo.source === "youtube" ||
                videoInfo.source === "vimeo" ? (
                  <iframe
                    src={videoInfo.embedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoInfo.url}
                    className="absolute inset-0 h-full w-full object-contain"
                    controls
                    preload="metadata"
                    onError={() => {
                      setVideoInfo({
                        ...videoInfo,
                        isValid: false,
                        error: "Unable to load video. Please check the URL.",
                      });
                      setShowPreview(false);
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            </div>
          )}

          {/* Example URLs */}
          {!urlInput && (
            <div className="space-y-3">
              <Label className="text-muted-foreground">Example URLs</Label>
              <div className="space-y-2">
                {[
                  {
                    label: "YouTube",
                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    icon: <Youtube className="h-4 w-4 text-red-500" />,
                  },
                  {
                    label: "Vimeo",
                    url: "https://vimeo.com/123456789",
                    icon: <Video className="h-4 w-4 text-blue-500" />,
                  },
                  {
                    label: "Direct",
                    url: "https://example.com/video.mp4",
                    icon: <Video className="h-4 w-4" />,
                  },
                ].map((example) => (
                  <button
                    key={example.label}
                    onClick={() => handleUrlChange(example.url)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                  >
                    {example.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{example.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {example.url}
                      </p>
                    </div>
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!videoInfo?.isValid}>
            <Play className="mr-2 h-4 w-4" />
            Add Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

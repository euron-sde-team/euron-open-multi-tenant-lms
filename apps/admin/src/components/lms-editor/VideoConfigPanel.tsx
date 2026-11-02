"use client";

import { cn, Button, Input, Label } from "@open-mtlms/core";
import type { LMSVideoConfig } from "@open-mtlms/shared";
import { Film, Link as LinkIcon, Play, Trash2, Video, Youtube } from "lucide-react";
import { useState } from "react";

import {
  extractYouTubeId,
  getVideoProvider,
  makeVideoConfig,
  type LectureVideoProvider,
} from "../../lib/utils/lms-mapper";

interface VideoConfigPanelProps {
  video?: LMSVideoConfig;
  onChange: (video: LMSVideoConfig | undefined) => void;
  className?: string;
  /** When true, renders without outer border/padding (for use inside dialogs) */
  compact?: boolean;
}

const PROVIDER_OPTIONS: Array<{
  id: LectureVideoProvider;
  label: string;
  icon: typeof Video;
  inputLabel: string;
  placeholder: string;
  help: string;
}> = [
  {
    id: "evs",
    label: "EVS",
    icon: Video,
    inputLabel: "EVS video ID",
    placeholder: "e.g. vid_01JABCDEF...",
    help: "Paste the video id from your video system (EVS). Learners get a short-lived signed playback session.",
  },
  {
    id: "hls",
    label: "HLS link",
    icon: LinkIcon,
    inputLabel: "HLS playlist URL",
    placeholder: "https://cdn.example.com/video/master.m3u8",
    help: "A public .m3u8 playlist URL.",
  },
  {
    id: "mp4",
    label: "MP4 link",
    icon: Film,
    inputLabel: "MP4 file URL",
    placeholder: "https://cdn.example.com/video.mp4",
    help: "A direct link to an .mp4 file.",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    inputLabel: "YouTube video URL or ID",
    placeholder: "Paste YouTube URL or video ID",
    help: "Paste a YouTube URL (e.g., https://youtube.com/watch?v=xxxxx) or just the video ID.",
  },
];

/**
 * Lecture video source editor. A lecture points at an EVS video id, an
 * external HLS or MP4 URL, or a YouTube video. Nothing is uploaded from here.
 */
export function VideoConfigPanel({ video, onChange, className, compact = false }: VideoConfigPanelProps) {
  const [provider, setProvider] = useState<LectureVideoProvider>(getVideoProvider(video) ?? "evs");
  const [value, setValue] = useState(video?.videoId || "");
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const option = PROVIDER_OPTIONS.find((o) => o.id === provider) ?? PROVIDER_OPTIONS[0];

  const commit = (nextProvider: LectureVideoProvider, raw: string) => {
    const v = raw.trim();
    setError(null);
    if (!v) {
      onChange(undefined);
      return;
    }
    if (nextProvider === "youtube") {
      const id = extractYouTubeId(v);
      if (!id) {
        setError("Enter a YouTube URL or an 11 character video ID.");
        return;
      }
      if (id !== v) setValue(id);
      onChange(makeVideoConfig("youtube", id));
      return;
    }
    if ((nextProvider === "hls" || nextProvider === "mp4") && !/^https?:\/\//i.test(v)) {
      setError("Enter a full http(s) URL.");
      return;
    }
    onChange(makeVideoConfig(nextProvider, v));
  };

  const handleProviderChange = (next: LectureVideoProvider) => {
    setProvider(next);
    setShowPreview(false);
    setError(null);
    setValue("");
    if (video) onChange(undefined);
  };

  const handleRemove = () => {
    setValue("");
    setShowPreview(false);
    setError(null);
    onChange(undefined);
  };

  const canPreview = !!value && !error && (provider === "youtube" || provider === "mp4");

  return (
    <div className={cn("space-y-3", !compact && "p-4 border rounded-lg bg-card", className)}>
      <div className="flex items-center justify-between">
        {!compact ? <h4 className="font-medium">Video Configuration</h4> : <span />}
        {video && (
          <Button variant="ghost" size="sm" onClick={handleRemove} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Remove Video
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Video Provider</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {PROVIDER_OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => handleProviderChange(o.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-sm transition-colors whitespace-nowrap",
                  provider === o.id ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="videoId">{option.inputLabel}</Label>
        <div className="flex gap-2">
          <Input
            id="videoId"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => commit(provider, value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(provider, value);
              }
            }}
            placeholder={option.placeholder}
            className="flex-1"
          />
          {canPreview && (
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Play className="h-4 w-4 mr-1" />
              {showPreview ? "Hide" : "Preview"}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">{option.help}</p>
      </div>

      {showPreview && canPreview && provider === "youtube" && (
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${extractYouTubeId(value) ?? value}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {showPreview && canPreview && provider === "mp4" && (
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <video src={value.trim()} controls className="w-full h-full" />
        </div>
      )}
    </div>
  );
}

export default VideoConfigPanel;

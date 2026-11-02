"use client";

import type {
  SectionConfig,
  TestimonialsContent,
  VideoTestimonial,
} from "@open-mtlms/shared";
import { Play, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface VideoTestimonialsProps {
  section: SectionConfig;
}

/**
 * Extract the 11-char YouTube video id from any common URL form, including
 * Shorts (youtube.com/shorts/VIDEO_ID). A Shorts video plays in the normal
 * embed player, so a Shorts id works everywhere a normal id does.
 */
function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
   
  const match = url.match(
    /^.*(youtu\.be\/|shorts\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
  );
  return match && match[2]?.length === 11 ? match[2] : null;
}

/** True when the URL is a YouTube Shorts link (used to default to portrait). */
function isShortsUrl(url: string | null | undefined): boolean {
  return !!url && /youtube\.com\/shorts\//i.test(url);
}

/**
 * Resolve the display orientation: explicit choice wins; otherwise Shorts URLs
 * default to portrait and everything else to landscape.
 */
function resolveOrientation(video: VideoTestimonial): "landscape" | "portrait" {
  if (video.orientation) return video.orientation;
  return isShortsUrl(video.youtubeUrl) ? "portrait" : "landscape";
}

function getYoutubeEmbedUrl(url: string | null | undefined): string | null {
  const id = getYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0&autoplay=1` : null;
}

/** Custom thumbnail if provided, else the video's YouTube thumbnail. */
function getVideoThumbnail(video: VideoTestimonial): string | null {
  if (video.thumbnail) return video.thumbnail;
  const id = getYoutubeId(video.youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * Shared "Video testimonials" block used by every testimonials section variant.
 *
 * The `videoTestimonials` field lives on the testimonials content for all
 * variants, but only some section components rendered it. This component
 * centralises the cards + on-page YouTube modal + editor add/remove controls so
 * every testimonials section shows video testimonials consistently. It renders
 * nothing in view mode when there are no videos, so it never adds empty space.
 */
export function VideoTestimonials({ section }: VideoTestimonialsProps) {
  const content = section.content as TestimonialsContent;
  const { EditableText, EditableImage, isEditMode, updateSectionContent } =
    useSectionEditor();

  // The video currently playing in the modal (null = closed). We keep the whole
  // testimonial so the modal can size itself to the video orientation.
  const [activeVideo, setActiveVideo] = useState<VideoTestimonial | null>(null);

  const videoTestimonials = content.videoTestimonials ?? [];

  const handleVideoField = (key: keyof TestimonialsContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleVideoUpdate = (
    index: number,
    updates: Partial<VideoTestimonial>,
  ) => {
    const next = [...videoTestimonials];
    next[index] = { ...next[index], ...updates };
    handleVideoField("videoTestimonials", next);
  };

  const addVideo = () => {
    handleVideoField("videoTestimonials", [
      ...videoTestimonials,
      {
        id: `video-${Date.now()}`,
        youtubeUrl: "",
        title: "New video testimonial",
        author: "",
      },
    ]);
  };

  const removeVideo = (index: number) => {
    handleVideoField(
      "videoTestimonials",
      videoTestimonials.filter((_, i) => i !== index),
    );
  };

  // Modal only closes on Escape / click-away; lock scroll while open.
  useEffect(() => {
    if (!activeVideo) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveVideo(null);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [activeVideo]);

  // Nothing to show in view mode with no videos: render nothing.
  if (!isEditMode && videoTestimonials.length === 0) return null;

  return (
    <>
      <div className="mt-20">
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.videoHeadline || "Video testimonials"}
            onChange={(value) => handleVideoField("videoHeadline", value)}
            styleKey="videoHeadline"
            as="h3"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videoTestimonials.map((video, index) => {
            const thumbnail = getVideoThumbnail(video);
            const isPortrait = resolveOrientation(video) === "portrait";
            return (
              <div
                key={video.id || index}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md"
              >
                {/* Clickable thumbnail (opens modal in view mode). Portrait
                    videos (incl. YouTube Shorts) use a 9:16 frame; the thumbnail
                    is centered so a landscape thumb from a Shorts still fills. */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditMode && video.youtubeUrl) {
                      setActiveVideo(video);
                    }
                  }}
                  className={`relative block w-full overflow-hidden bg-muted ${
                    isPortrait ? "mx-auto aspect-[9/16] max-w-[280px]" : "aspect-video"
                  }`}
                  aria-label={video.title || "Play video testimonial"}
                >
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt={video.title || "Video testimonial"}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Play className="h-10 w-10" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-transform group-hover:scale-110">
                      <Play className="ml-1 h-6 w-6 fill-current" />
                    </span>
                  </span>
                </button>

                <div className="flex flex-1 flex-col gap-1 p-5">
                  <EditableText
                    value={video.title || ""}
                    onChange={(value) =>
                      handleVideoUpdate(index, { title: value })
                    }
                    styleKey={`video-${index}-title`}
                    className="font-semibold"
                  />
                  {(video.author || isEditMode) && (
                    <p className="text-sm text-muted-foreground">
                      <EditableText
                        value={video.author || ""}
                        onChange={(value) =>
                          handleVideoUpdate(index, { author: value })
                        }
                        styleKey={`video-${index}-author`}
                      />
                    </p>
                  )}

                  {/* Edit-only controls */}
                  {isEditMode && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={video.youtubeUrl}
                        onChange={(e) =>
                          handleVideoUpdate(index, {
                            youtubeUrl: e.target.value,
                          })
                        }
                        placeholder="YouTube URL or Shorts link (e.g. https://youtu.be/… or /shorts/…)"
                        className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                      />
                      {video.youtubeUrl && !getYoutubeId(video.youtubeUrl) && (
                        <p className="text-xs text-destructive">
                          Enter a valid YouTube video or Shorts URL.
                        </p>
                      )}
                      {/* Orientation switch: normal (landscape) vs portrait
                          (9:16, for vertical videos and YouTube Shorts). */}
                      <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
                        {(["landscape", "portrait"] as const).map((o) => {
                          const active = resolveOrientation(video) === o;
                          return (
                            <button
                              key={o}
                              type="button"
                              onClick={() =>
                                handleVideoUpdate(index, { orientation: o })
                              }
                              className={`flex-1 rounded px-2 py-1 font-medium capitalize transition-colors ${
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {o === "landscape" ? "Normal" : "Portrait"}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between">
                        <EditableImage
                          src={video.thumbnail || ""}
                          alt={video.title || "Custom thumbnail"}
                          onChange={(src) =>
                            handleVideoUpdate(index, { thumbnail: src })
                          }
                          className="h-9 w-16 rounded"
                          aspectRatio="video"
                          placeholder="Thumb"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVideo(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={addVideo}
              className="rounded-full"
            >
              <Plus className="mr-2 h-4 w-4" /> Add video testimonial
            </Button>
          </div>
        )}
      </div>

      {/* Video testimonial modal (on-page YouTube iframe). Portrait videos
          (incl. Shorts) get a narrow 9:16 frame; normal videos a wide 16:9.
          Portaled to <body> so `fixed` anchors to the viewport and is not
          trapped by a transformed ancestor section (which would push it
          off-screen when the page is scrolled). */}
      {activeVideo &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveVideo(null);
          }}
        >
          <button
            type="button"
            onClick={() => setActiveVideo(null)}
            aria-label="Close video"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>
          {getYoutubeEmbedUrl(activeVideo.youtubeUrl) ? (
            <div
              className={
                resolveOrientation(activeVideo) === "portrait"
                  ? "relative h-[85vh] max-h-[85vh] max-w-[95vw]"
                  : "relative w-full max-w-4xl"
              }
            >
              <div
                className={`relative overflow-hidden rounded-xl bg-black shadow-2xl ${
                  resolveOrientation(activeVideo) === "portrait"
                    ? "mx-auto aspect-[9/16] h-full"
                    : "aspect-video w-full"
                }`}
              >
                <iframe
                  src={getYoutubeEmbedUrl(activeVideo.youtubeUrl) as string}
                  title="Video testimonial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-card p-6 text-center shadow-2xl">
              <p className="text-card-foreground">
                This video cannot be embedded.
              </p>
            </div>
          )}
        </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { cn } from "@open-mtlms/core";
import { ImageIcon, Pencil, Video } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { getEducationalPlaceholderImage } from "@/lib/constants/placeholders";
import { useCourseEditMode } from "@/lib/contexts/course-edit-mode-context";
import { useCourseStore } from "@/lib/stores/course-store";

import { ThumbnailPickerModal } from "../modals/ThumbnailPickerModal";

interface CourseEditableThumbnailProps {
  /** Display URL: prefer web, fallback to mobile for preview */
  displaySrc: string;
  alt: string;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholder?: string;
  showVideo?: boolean;
  overlayClassName?: string;
}

/**
 * Editable course hero thumbnail. In edit mode, opening the picker asks for
 * both web and mobile thumbnails; the detail page shows only one image but
 * both URLs are stored for use by the platform.
 */
export function CourseEditableThumbnail({
  displaySrc,
  alt,
  className,
  aspectRatio = "video",
  placeholder = "Click to add thumbnails (web + mobile)",
  showVideo = false,
  overlayClassName,
}: CourseEditableThumbnailProps) {
  const { isEditMode } = useCourseEditMode();
  const { courseData, updateMedia } = useCourseStore();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "",
  }[aspectRatio];

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) {
      e.stopPropagation();
      setIsPickerOpen(true);
    }
  };

  const handleSelect = (payload: {
    thumbnailKey?: string | null;
    secondaryThumbnailKey?: string | null;
    previewKey?: string | null;
    thumbnailUrl: string;
    secondaryThumbnailUrl: string;
    previewUrl?: string;
  }) => {
    updateMedia({
      webThumbnailUrl: payload.thumbnailUrl,
      mobileThumbnailUrl: payload.secondaryThumbnailUrl,
      previewUrl: payload.previewUrl,
      thumbnailKey: payload.thumbnailKey,
      secondaryThumbnailKey: payload.secondaryThumbnailKey,
      previewKey: payload.previewKey,
    });
  };

  if (!isEditMode) {
    if (!displaySrc) return null;
    return (
      <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
        <Image src={displaySrc} alt={alt} fill className="object-cover" unoptimized />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg transition-all",
          "border-2 border-dashed border-transparent hover:border-primary/50",
          aspectRatioClass,
          className
        )}
        onClick={handleClick}
      >
        {displaySrc ? (
          <>
            <Image src={displaySrc} alt={alt} fill className="object-cover" unoptimized />
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100",
                overlayClassName
              )}
            >
              <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-2 shadow-lg">
                <Pencil className="h-4 w-4" />
                <span className="text-sm font-medium">Change thumbnails (web + mobile)</span>
              </div>
            </div>
          </>
        ) : (
          <div className="relative flex h-full min-h-[150px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 transition-colors hover:border-primary/50">
            <img
              src={getEducationalPlaceholderImage(courseData.slug || courseData.id || "course")}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 p-4">
              {showVideo ? (
                <Video className="h-8 w-8 text-white" />
              ) : (
                <ImageIcon className="h-8 w-8 text-white" />
              )}
              <span className="text-center text-sm text-white drop-shadow-sm">{placeholder}</span>
            </div>
          </div>
        )}
      </div>

      <ThumbnailPickerModal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelect}
        tenantId={courseData.tenantId ?? ""}
        courseId={courseData.id ?? null}
        currentWebImage={courseData.webThumbnailUrl || ""}
        currentMobileImage={courseData.mobileThumbnailUrl || ""}
        currentPreviewUrl={courseData.previewUrl || ""}
      />
    </>
  );
}

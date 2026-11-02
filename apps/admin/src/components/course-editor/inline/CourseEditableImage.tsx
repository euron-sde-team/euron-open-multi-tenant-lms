"use client";

import { cn } from "@open-mtlms/core";
import { ImageIcon, Pencil, Video } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { useCourseEditMode } from "@/lib/contexts/course-edit-mode-context";

import { ImagePickerModal } from "../modals/ImagePickerModal";

interface CourseEditableImageProps {
  src: string;
  alt: string;
  onChange: (src: string, alt: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholder?: string;
  showVideo?: boolean;
  overlayClassName?: string;
}

export function CourseEditableImage({
  src,
  alt,
  onChange,
  className,
  aspectRatio = "video",
  placeholder = "Click to add image",
  showVideo = false,
  overlayClassName,
}: CourseEditableImageProps) {
  const { isEditMode } = useCourseEditMode();
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

  const handleImageSelect = (newSrc: string, newAlt: string) => {
    onChange(newSrc, newAlt);
  };

  // If not in edit mode, just render the image
  if (!isEditMode) {
    if (!src) {
      return null;
    }
    return (
      <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
        <Image src={src} alt={alt} fill className="object-cover" unoptimized />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg transition-all",
          "border-2 border-dashed border-transparent",
          "hover:border-primary/50",
          aspectRatioClass,
          className
        )}
        onClick={handleClick}
      >
        {src ? (
          <>
            <Image src={src} alt={alt} fill className="object-cover" unoptimized />
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100",
                overlayClassName
              )}
            >
              <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-2 shadow-lg">
                <Pencil className="h-4 w-4" />
                <span className="text-sm font-medium">Change Image</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[150px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-4 text-muted-foreground transition-colors hover:border-primary/50">
            {showVideo ? (
              <Video className="h-8 w-8" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <span className="text-sm">{placeholder}</span>
          </div>
        )}
      </div>

      <ImagePickerModal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleImageSelect}
        currentImage={src}
        currentAlt={alt}
      />
    </>
  );
}

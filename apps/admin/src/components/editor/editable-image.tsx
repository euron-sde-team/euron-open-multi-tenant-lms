"use client";

import type { MediaImage } from "@open-mtlms/shared";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { cn } from "@/lib/utils";

import { ImagePicker } from "./image-picker";

interface EditableImageProps {
  src: string;
  alt: string;
  onChange: (src: string, alt: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholder?: string;
  /**
   * Icon-only affordance for tiny thumbnail controls (e.g. ~40px gallery
   * per-item image editors) where the full "Change Image" label would wrap.
   * Defaults to false (labelled overlay unchanged).
   */
  compact?: boolean;
}

export function EditableImage({
  src,
  alt,
  onChange,
  className,
  aspectRatio = "auto",
  placeholder = "Click to add image",
  compact = false,
}: EditableImageProps) {
  const isEditMode = useEditMode();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Check for valid image src (must be non-empty string)
  const hasValidSrc = Boolean(
    typeof src === "string" && src.trim().length > 0
  );

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

  const handleImageSelect = (image: MediaImage) => {
    onChange(image.src, image.alt);
  };

  // If not in edit mode, just render the image
  if (!isEditMode) {
    if (!hasValidSrc) {
      return null;
    }
    return (
      <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
        <Image src={src} alt={alt} fill className="object-cover" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50",
          aspectRatioClass,
          className
        )}
        onClick={handleClick}
      >
        {hasValidSrc ? (
          <>
            <Image src={src} alt={alt} fill className="object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg bg-background",
                  compact ? "p-1.5" : "px-4 py-2"
                )}
              >
                <ImageIcon className="h-4 w-4" />
                {!compact && (
                  <span className="text-sm font-medium">Change Image</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-2 text-muted-foreground",
              compact ? "p-1" : "min-h-[150px] p-4"
            )}
          >
            <ImageIcon className={compact ? "h-4 w-4" : "h-8 w-8"} />
            {!compact && <span className="text-sm">{placeholder}</span>}
          </div>
        )}
      </div>

      <ImagePicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleImageSelect}
        currentImage={src}
        currentAlt={alt}
      />
    </>
  );
}

"use client";

import { ImageIcon, Pencil, Video } from "lucide-react";
import { cn } from "../../lib/utils";
import { useIsEditMode, useCourseEdit } from "../../context";

interface EditableThumbnailProps {
  /** Primary display URL (typically web thumbnail) */
  src: string;
  /** Fallback URL (typically mobile thumbnail) */
  fallbackSrc?: string;
  alt: string;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholder?: string;
  showVideoIcon?: boolean;
  /** Preview URL for video courses */
  previewUrl?: string;
  overlayClassName?: string;
}

/**
 * Editable thumbnail component that displays an image when not in edit mode,
 * and shows edit controls when in edit mode. Clicking in edit mode triggers
 * the onEditThumbnail callback from context.
 */
export function EditableThumbnail({
  src,
  fallbackSrc,
  alt,
  className,
  aspectRatio = "video",
  placeholder = "Click to add thumbnail",
  showVideoIcon = false,
  previewUrl,
  overlayClassName,
}: EditableThumbnailProps) {
  const isEditMode = useIsEditMode();
  const { callbacks } = useCourseEdit();

  const displaySrc = src || fallbackSrc;

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "",
  }[aspectRatio];

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode && callbacks.onEditThumbnail) {
      e.stopPropagation();
      callbacks.onEditThumbnail();
    }
  };

  // Read-only mode
  if (!isEditMode) {
    if (!displaySrc) return null;
    return (
      <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
        <img src={displaySrc} alt={alt} className="h-full w-full object-cover" />
      </div>
    );
  }

  // Edit mode
  return (
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
          <img src={displaySrc} alt={alt} className="h-full w-full object-cover" />
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100",
              overlayClassName
            )}
          >
            <div className="flex items-center gap-2 rounded-lg bg-background px-4 py-2 shadow-lg">
              <Pencil className="h-4 w-4" />
              <span className="text-sm font-medium">Change thumbnail</span>
            </div>
          </div>
        </>
      ) : (
        <div className="relative flex h-full min-h-[150px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 transition-colors hover:border-primary/50">
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            {showVideoIcon ? (
              <Video className="h-8 w-8 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-center text-sm text-muted-foreground">{placeholder}</span>
          </div>
        </div>
      )}
    </div>
  );
}

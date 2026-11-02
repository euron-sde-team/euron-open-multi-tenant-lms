"use client";

import { Pencil, BookOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { useIsEditMode, useBookEdit, useBookData } from "../../context";

/** Resolve S3 key to full URL when thumbnailBaseUrl is provided. */
function resolveThumbnailSrc(
  keyOrUrl: string | null | undefined,
  baseUrl: string | null | undefined
): string | null {
  if (!keyOrUrl?.trim()) return null;
  const val = keyOrUrl.trim();
  if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:")) {
    return val;
  }
  if (!baseUrl?.trim()) return val; // Return as-is; may fail to load if it's a key
  const base = baseUrl.replace(/\/$/, "");
  const key = val.startsWith("/") ? val.slice(1) : val;
  return `${base}/${key}`;
}

interface EditableThumbnailProps {
  /** Primary display URL or S3 key (typically web thumbnail) */
  src: string;
  /** Fallback URL or S3 key (typically mobile thumbnail) */
  fallbackSrc?: string;
  alt: string;
  className?: string;
  aspectRatio?: "book" | "square" | "portrait" | "auto";
  placeholder?: string;
  overlayClassName?: string;
}

/**
 * Editable thumbnail component for books that displays an image when not in edit mode,
 * and shows edit controls when in edit mode.
 */
export function EditableThumbnail({
  src,
  fallbackSrc,
  alt,
  className,
  aspectRatio = "book",
  placeholder = "Click to add book cover",
  overlayClassName,
}: EditableThumbnailProps) {
  const isEditMode = useIsEditMode();
  const { callbacks } = useBookEdit();
  const { thumbnailBaseUrl } = useBookData();

  const rawSrc = src || fallbackSrc;
  const displaySrc = rawSrc ? resolveThumbnailSrc(rawSrc, thumbnailBaseUrl) : null;

  const aspectRatioClass = {
    book: "aspect-[3/4]",
    square: "aspect-square",
    portrait: "aspect-[2/3]",
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
              <span className="text-sm font-medium">Change cover</span>
            </div>
          </div>
        </>
      ) : (
        <div className="relative flex h-full min-h-[200px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 transition-colors hover:border-primary/50">
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <span className="text-center text-sm text-muted-foreground">{placeholder}</span>
          </div>
        </div>
      )}
    </div>
  );
}

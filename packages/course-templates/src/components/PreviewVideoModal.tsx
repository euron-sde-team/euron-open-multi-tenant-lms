"use client";

import { X, ExternalLink } from "lucide-react";
import { useEffect, useCallback } from "react";
import { getYoutubeEmbedUrl } from "../lib/utils";

interface PreviewVideoModalProps {
  open: boolean;
  previewUrl: string;
  onClose: () => void;
}

/**
 * Modal component for playing course preview videos.
 * Supports YouTube URLs with embedded player; other URLs open in a new tab.
 */
export function PreviewVideoModal({ open, previewUrl, onClose }: PreviewVideoModalProps) {
  const embedUrl = getYoutubeEmbedUrl(previewUrl);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle opening non-YouTube URL in new tab
  const handleOpenInNewTab = () => {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Course preview video"
    >
      {/* Close button - top right */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close preview"
      >
        <X className="h-6 w-6" />
      </button>

      {embedUrl ? (
        // YouTube video - show iframe
        <div className="relative w-full max-w-4xl px-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
            <iframe
              src={embedUrl}
              title="Course preview video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : (
        // Non-YouTube URL - show message with link
        <div className="relative w-full max-w-md px-4">
          <div
            className="rounded-xl p-6 text-center shadow-2xl"
            style={{ backgroundColor: "hsl(var(--card))" }}
          >
            <p className="mb-4" style={{ color: "hsl(var(--card-foreground))" }}>
              This preview video cannot be embedded. Would you like to open it in a new tab?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                style={{
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--card-foreground))",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 active:opacity-95"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

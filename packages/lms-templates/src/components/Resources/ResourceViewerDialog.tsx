"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ResourceViewerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close (backdrop click, X, Escape) */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Viewer body (iframe/object/img) */
  children: React.ReactNode;
  /** Additional class for the dialog panel */
  className?: string;
}

/**
 * Lightweight modal used to preview resources inline (non-downloadable PDFs,
 * image enlargements). Renders via portal so it escapes any stacking context.
 */
export function ResourceViewerDialog({
  open,
  onClose,
  title,
  children,
  className,
}: ResourceViewerDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative z-10 flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ResourceViewerDialog;

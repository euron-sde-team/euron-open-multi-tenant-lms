"use client";

import { Button, useToast } from "@open-mtlms/core";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { uploadApi } from "@/lib/api/upload";

// Preset diagram sizes, keeps the admin UX simple (no pixel tuning) and
// makes the wire format stable for renderers on web + mobile. Stored as a
// short string in the question JSON. New questions default to `md`; legacy
// questions without an explicit size fall back to `md` in readers.
export type DiagramSize = "sm" | "md" | "lg" | "xl";

const SIZE_LABELS: Record<DiagramSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
  xl: "XL",
};
const SIZE_ORDER: DiagramSize[] = ["sm", "md", "lg", "xl"];

interface DiagramUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Preset size. Omit + onSizeChange to hide the size picker. */
  size?: DiagramSize;
  onSizeChange?: (size: DiagramSize) => void;
  /** UI density. `compact` for inside option rows; default for stem. */
  variant?: "default" | "compact";
  /** Accessibility / disambiguation when many uploaders share a screen. */
  label?: string;
  disabled?: boolean;
}

/**
 * Diagram / image picker for test-series questions. Used on the question stem
 * AND on every MCQ option, hence the `compact` variant so it doesn't crowd the
 * option row. Stores the public URL the upload endpoint returns; persisting
 * a URL (not a storage key) so the renderer can show it without extra plumbing.
 */
export function DiagramUploader({
  value,
  onChange,
  size,
  onSizeChange,
  variant = "default",
  label = "diagram",
  disabled,
}: DiagramUploaderProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Pick an image (PNG, JPG, SVG, WebP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Diagrams must be 5 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const res = await uploadApi.uploadFile(file, "test-questions");
      onChange(res.url);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const compact = variant === "compact";

  if (value) {
    return (
      <div className="flex items-start gap-2">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border block overflow-hidden rounded border bg-white"
          aria-label={`Open ${label} in new tab`}
        >
          <img
            src={value}
            alt={label}
            className={compact ? "h-12 w-12 object-contain" : "h-24 w-24 object-contain"}
          />
        </a>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePick}
            disabled={disabled || uploading}
            type="button"
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <ImagePlus className="mr-1 h-3 w-3" />
            )}
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(null)}
            disabled={disabled || uploading}
            type="button"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Remove
          </Button>
          {onSizeChange && (
            <div className="border-border mt-1 flex items-center gap-0.5 rounded-md border p-0.5">
              {SIZE_ORDER.map((s) => {
                const active = (size ?? "md") === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSizeChange(s)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`Set ${label} size to ${s}`}
                    className={
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {SIZE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handlePick}
        disabled={disabled || uploading}
        type="button"
        className={compact ? "h-8" : undefined}
      >
        {uploading ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <ImagePlus className="mr-1 h-3 w-3" />
        )}
        {uploading ? "Uploading…" : compact ? "Diagram" : "Upload diagram"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </>
  );
}

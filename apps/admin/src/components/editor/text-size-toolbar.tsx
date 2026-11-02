"use client";

import { Button, Dialog, DialogContent, DialogTrigger } from "@open-mtlms/core";
import type { TextStyle } from "@open-mtlms/shared";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Text size presets, small to large. Kept in one place so the picker and the
 * class map in editable-text.tsx stay in sync. The larger presets are
 * responsive (mobile-capped) in FONT_SIZE_CLASSES so big text never overflows
 * a phone.
 */
const FONT_SIZE_PRESETS = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "Sm" },
  { value: "base", label: "Base" },
  { value: "lg", label: "Lg" },
  { value: "xl", label: "Xl" },
  { value: "2xl", label: "2xl" },
  { value: "3xl", label: "3xl" },
  { value: "4xl", label: "4xl" },
  { value: "5xl", label: "5xl" },
  { value: "6xl", label: "6xl" },
] as const;

interface TextSizeToolbarProps {
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  children: React.ReactNode;
}

/**
 * A dedicated size picker, surfaced as its own toolbar button (separate from
 * the paintbrush/typography popover, which now handles colour + weight + align
 * only). Clicking a preset toggles that size on the text.
 */
export function TextSizeToolbar({
  style,
  onStyleChange = () => {},
  children,
}: TextSizeToolbarProps) {
  const s = style ?? {};

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-64 p-4 sm:max-w-[16rem]">
        <div className="space-y-3">
          {/* pr-6 keeps the title clear of the dialog's built-in close (X) */}
          <span className="block pr-6 text-sm font-medium">Text Size</span>
          <div className="flex flex-wrap gap-1">
            {FONT_SIZE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  onStyleChange({
                    ...s,
                    fontSize: s.fontSize === preset.value ? undefined : preset.value,
                  })
                }
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  s.fontSize === preset.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {s.fontSize && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-center gap-1"
              onClick={() => onStyleChange({ ...s, fontSize: undefined })}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to original size
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

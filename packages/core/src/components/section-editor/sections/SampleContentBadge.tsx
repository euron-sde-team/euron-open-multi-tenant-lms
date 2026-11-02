"use client";

import { Sparkles } from "lucide-react";

/**
 * Editor-only chip shown above a listing that is rendering SAMPLE placeholder
 * cards (because the tenant hasn't published real content yet). Makes it obvious
 * the cards are a preview, not real published items. Kept compact and
 * left-aligned so it reads as a small section label rather than a floating
 * banner, and themed via CSS variables so it inherits each template's palette.
 * Never rendered on the live/preview page (callers gate on isEditMode).
 */
export function SampleContentBadge() {
  return (
    <div className="mb-4 flex">
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{
          color: "hsl(var(--primary))",
          backgroundColor: "hsl(var(--primary) / 0.09)",
        }}
        title="This is sample data, your published items will appear here automatically once you add content."
      >
        <Sparkles className="h-3 w-3" />
        Sample preview
      </span>
    </div>
  );
}

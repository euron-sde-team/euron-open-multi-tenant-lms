"use client";

import { cn } from "../../lib/utils";

/**
 * Uniform, responsive viewport for content lessons (PDF / TEXT / IMAGE / LINK).
 *
 * Shared by the student viewer (`ContentLessonView`), the admin preview, and
 * this loading skeleton so all three are identically sized at every breakpoint
 *, a fixed-height frame with internal scroll. Scaling: phone → tablet →
 * desktop, capped on very large monitors. Media inside must use `max-w-full`
 * and the frame uses `overflow-auto`, so nothing overflows horizontally.
 */
export const CONTENT_FRAME =
  "h-[58vh] min-h-[340px] sm:h-[66vh] sm:min-h-[440px] lg:h-[70vh] max-h-[820px]";

const shimmer = "animate-pulse rounded-md bg-muted";

interface ContentLessonSkeletonProps {
  className?: string;
}

/**
 * Frame-sized loading shimmer for a content lesson. Has the exact dimensions of
 * the rendered content frame, so swapping skeleton → content causes zero layout
 * shift at any screen size.
 */
export function ContentLessonSkeleton({
  className,
}: ContentLessonSkeletonProps) {
  return (
    <div
      className={cn(
        CONTENT_FRAME,
        "w-full overflow-hidden rounded-lg border bg-card",
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex h-full w-full flex-col gap-4 p-4 sm:p-6">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className={cn(shimmer, "h-9 w-9 shrink-0 rounded-lg")} />
          <div className="flex-1 space-y-2">
            <div className={cn(shimmer, "h-3.5 w-1/3")} />
            <div className={cn(shimmer, "h-3 w-1/4")} />
          </div>
        </div>

        {/* Large media block (fills remaining height) */}
        <div className={cn(shimmer, "min-h-0 flex-1 rounded-lg")} />

        {/* Caption lines */}
        <div className="space-y-2">
          <div className={cn(shimmer, "h-3 w-full")} />
          <div className={cn(shimmer, "h-3 w-5/6")} />
        </div>
      </div>
    </div>
  );
}

export default ContentLessonSkeleton;

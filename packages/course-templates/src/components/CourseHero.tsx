"use client";

import {
  Video,
  Radio,
  Layers,
  ChevronRight,
  Play,
} from "lucide-react";
import type { CourseFormData, CourseMode, CourseType } from "@open-mtlms/shared";
import { cn, formatCourseLanguages } from "../lib/utils";

interface CourseHeroProps {
  courseData: CourseFormData;
  categoryName?: string;
  className?: string;
}

const modeConfig: Record<CourseMode, { icon: typeof Video; label: string }> = {
  SELF_PACED: { icon: Video, label: "Self-Paced" },
  LIVE: { icon: Radio, label: "Live Course" },
  HYBRID: { icon: Layers, label: "Hybrid" },
};

const COURSE_TYPE_OVERRIDES: Partial<Record<CourseType, { icon: typeof Video; label: string }>> = {};

export function CourseHero({ courseData, categoryName, className }: CourseHeroProps) {
  const typeOverride = COURSE_TYPE_OVERRIDES[courseData.type];
  const ModeIcon = typeOverride?.icon || modeConfig[courseData.mode]?.icon || Video;
  const modeLabel = typeOverride?.label || modeConfig[courseData.mode]?.label || "Course";

  return (
    <section
      className={cn(
        "relative mb-1 flex flex-col-reverse gap-1 rounded-2xl p-1 sm:mb-4 sm:gap-3 md:p-6 lg:flex-row lg:items-start lg:rounded-2xl mx-auto max-w-7xl px-4 lg:border",
        className
      )}
      style={{
        background: `linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--muted)), hsl(var(--card)))`,
        borderColor: "hsl(var(--border))",
      }}
    >
      {/* Left Content */}
      <div className="w-full p-3 lg:w-1/2 lg:flex lg:flex-col lg:justify-center">
        {/* Breadcrumb */}
        <div className="hidden items-center gap-1 pb-2 lg:flex">
          <span
            className="text-sm font-medium cursor-pointer hover:opacity-80"
            style={{ color: "hsl(var(--primary))" }}
          >
            Home
          </span>
          <ChevronRight className="h-3 w-3 opacity-80" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>
            {categoryName || "Course"}
          </span>
        </div>

        {/* Mode Badge */}
        <div className="pb-2 lg:pb-4">
          <div
            className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}
          >
            <ModeIcon className="h-4 w-4" />
            {modeLabel}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center justify-center lg:items-start lg:text-left">
          <h1
            className="pb-2 text-xl font-bold sm:pb-4 md:text-3xl md:leading-tight lg:self-start"
            style={{ color: "hsl(var(--foreground))" }}
          >
            {courseData.title || "Course Title"}
          </h1>

          {/* Subtitle */}
          <p
            className="text-sm md:text-lg w-full lg:self-start"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {courseData.subTitle || "Course subtitle"}
          </p>

          {/* Meta: Language, Duration */}
          <div className="mt-2 flex flex-col flex-nowrap self-start md:gap-3">
            <span
              className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
              style={{ color: "hsl(var(--foreground))" }}
            >
              <span
                className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                🌐
              </span>
              {formatCourseLanguages(courseData.languages, courseData.language)}
            </span>
            <span
              className="mb-1 flex items-center text-sm font-medium md:mb-0 md:whitespace-nowrap"
              style={{ color: "hsl(var(--foreground))" }}
            >
              <span
                className="mr-2 flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                ⏱️
              </span>
              {courseData.duration || "Duration not set"}
            </span>
          </div>
        </div>
      </div>

      {/* Right - Thumbnail */}
      <div
        className="relative w-full overflow-hidden rounded-2xl shadow-md lg:w-1/2 border"
        style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
      >
        {courseData.webThumbnailUrl || courseData.mobileThumbnailUrl ? (
          <img
            src={courseData.webThumbnailUrl || courseData.mobileThumbnailUrl}
            alt={courseData.title || "Course thumbnail"}
            className="w-full h-auto object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="h-16 w-16 opacity-30" />
          </div>
        )}
        {/* Play overlay */}
        {courseData.previewUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/30">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <Play className="h-8 w-8 ml-0.5" style={{ color: "hsl(var(--primary))" }} />
            </div>
            <span className="mt-2 text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Preview this course
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

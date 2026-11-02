"use client";

import type { CourseFormData } from "@open-mtlms/shared";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@open-mtlms/core";
import { Eye, EyeOff } from "lucide-react";
import { useCourseData, useCourseEdit, useIsEditMode } from "../context";
import { cn } from "../lib/utils";

interface CourseSectionWrapperProps {
  sectionKey: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  headerActions?: React.ReactNode;
}

/**
 * Wraps a course section with visibility toggle (edit mode) and conditional rendering (preview mode).
 * When hidden in edit mode: shows dimmed content with "Hidden" overlay.
 * When hidden in preview mode: section is not rendered.
 */
export function CourseSectionWrapper({
  sectionKey,
  children,
  className,
  style,
  headerActions,
}: CourseSectionWrapperProps) {
  const { courseData } = useCourseData();
  const { callbacks } = useCourseEdit();
  const isEditMode = useIsEditMode();

  const sv = (courseData as CourseFormData).sectionVisibility ?? {};
  const isVisible = sv[sectionKey] !== false;

  // Preview mode: hide section entirely when not visible
  if (!isEditMode && !isVisible) {
    return null;
  }

  const handleToggle = () => {
    callbacks.onToggleSectionVisibility?.(sectionKey);
  };

  const showHeaderActions = isEditMode && (callbacks.onToggleSectionVisibility || headerActions);
  const hasHeaderSlot = Boolean(headerActions || callbacks.onToggleSectionVisibility);

  return (
    <section
      className={cn(
        "relative overflow-hidden",
        className,
        hasHeaderSlot && "pr-24"
      )}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        ...style,
      }}
    >
      {/* Visibility toggle and header actions - only in edit mode */}
      {showHeaderActions && (
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-2"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {headerActions}
          {callbacks.onToggleSectionVisibility && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle();
                  }}
                >
                  {isVisible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isVisible ? "Hide Section" : "Show Section"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Hidden overlay - only in edit mode when hidden */}
      {isEditMode && !isVisible && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: "hsl(var(--background) / 0.5)" }}
        >
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-2"
            style={{ backgroundColor: "hsl(var(--muted))" }}
          >
            <EyeOff className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            <span className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
              Hidden
            </span>
          </div>
        </div>
      )}

      {children}
    </section>
  );
}

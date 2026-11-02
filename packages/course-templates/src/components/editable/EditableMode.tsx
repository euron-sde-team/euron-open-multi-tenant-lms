"use client";

import { Video, Radio, Layers, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";
import { useIsEditMode, useCourseEdit, useCourseData } from "../../context";
import type { CourseMode, CourseType } from "@open-mtlms/shared";

const modeConfig: Record<CourseMode, { icon: typeof Video; label: string }> = {
  SELF_PACED: { icon: Video, label: "Self-Paced" },
  LIVE: { icon: Radio, label: "Live Course" },
  HYBRID: { icon: Layers, label: "Hybrid" },
};

const COURSE_TYPE_OVERRIDES: Partial<Record<CourseType, { icon: typeof Video; label: string }>> = {};

// Live and hybrid delivery are not part of this build.
const modeOptions: CourseMode[] = ["SELF_PACED"];

interface EditableModeProps {
  value: CourseMode;
  className?: string;
  iconClassName?: string;
  style?: React.CSSProperties;
}

/**
 * Editable mode selector component that renders the mode label when not in edit mode,
 * and a dropdown selector when in edit mode.
 * When modeReadOnly is true (from context), always renders as read-only label.
 */
export function EditableMode({
  value,
  className,
  iconClassName,
  style,
}: EditableModeProps) {
  const isEditMode = useIsEditMode();
  const { callbacks, modeReadOnly } = useCourseEdit();
  const { courseData } = useCourseData();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // If courseType has an override, use that instead of mode-based config
  const typeOverride = COURSE_TYPE_OVERRIDES[courseData.type];
  const config = typeOverride || modeConfig[value] || modeConfig.SELF_PACED;
  const ModeIcon = config.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) {
        e.stopPropagation();
        setIsOpen(!isOpen);
      }
    },
    [isEditMode, isOpen]
  );

  const handleSelectMode = useCallback(
    (mode: CourseMode) => {
      if (mode !== value) {
        callbacks.onEditMode?.(mode);
      }
      setIsOpen(false);
    },
    [value, callbacks]
  );

  // If not in edit mode OR mode is read-only OR type has an override, render as read-only label
  if (!isEditMode || modeReadOnly || typeOverride) {
    return (
      <span className={cn("flex items-center gap-2", className)} style={style}>
        <ModeIcon className={cn("h-4 w-4", iconClassName)} />
        {config.label}
      </span>
    );
  }

  // In edit mode (and mode is not read-only), show clickable dropdown
  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 cursor-pointer transition-all",
          "hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/50 hover:outline-offset-2 rounded px-2 py-1 -mx-2 -my-1",
          className
        )}
        style={style}
      >
        <ModeIcon className={cn("h-4 w-4", iconClassName)} />
        <span>{config.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-md border shadow-lg"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <div className="py-1">
            {modeOptions.map((mode) => {
              const optionConfig = modeConfig[mode];
              const OptionIcon = optionConfig.icon;
              const isSelected = mode === value;

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSelectMode(mode)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    "hover:bg-primary/10",
                    isSelected && "bg-primary/5"
                  )}
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  <OptionIcon className="h-4 w-4" />
                  <span className="flex-1 text-left">{optionConfig.label}</span>
                  {isSelected && <Check className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

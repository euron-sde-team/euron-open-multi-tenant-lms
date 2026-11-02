"use client";

import React from "react";
import {
  Check,
  Play,
  Lock,
  Circle,
  Video,
  ClipboardCheck,
  HelpCircle,
  FileText,
  AlignLeft,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";
import { cn, formatDuration } from "../../lib/utils";

interface LessonStatusProps {
  /** Whether lesson is completed */
  isCompleted: boolean;
  /** Whether lesson is currently active/playing */
  isActive?: boolean;
  /** Whether lesson is locked */
  isLocked?: boolean;
  /** Whether lesson is free preview */
  isFreePreview?: boolean;
  /** Lesson type for type-specific icons */
  lessonType?: string;
  /** Progress percentage (0-100) for partial completion */
  progress?: number;
  /** Duration in seconds */
  duration?: number;
  /** Display variant */
  variant?: "icon" | "badge" | "full";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class name */
  className?: string;
}

export function LessonStatus({
  isCompleted,
  isActive = false,
  isLocked = false,
  isFreePreview = false,
  lessonType,
  progress,
  duration,
  variant = "icon",
  size = "md",
  className,
}: LessonStatusProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const containerSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const normalizedType = lessonType?.toLowerCase();
  const isQuiz = normalizedType === "quiz";
  const isAssignment = normalizedType === "assignment";
  const isPdf = normalizedType === "pdf";
  const isText = normalizedType === "text";
  const isImage = normalizedType === "image";
  const isLink = normalizedType === "link";

  // Determine status
  const getStatus = () => {
    if (isLocked) return "locked";
    if (isCompleted) return "completed";
    if (isActive) return "active";
    if (progress && progress > 0) return "in-progress";
    return "not-started";
  };

  const status = getStatus();

  // Get type-specific icon for non-completed states
  const getTypeIcon = (iconClass: string) => {
    if (isQuiz) return <HelpCircle className={iconClass} />;
    if (isAssignment) return <ClipboardCheck className={iconClass} />;
    if (isPdf) return <FileText className={iconClass} />;
    if (isText) return <AlignLeft className={iconClass} />;
    if (isImage) return <ImageIcon className={iconClass} />;
    if (isLink) return <LinkIcon className={iconClass} />;
    return null;
  };

  // Icon variant
  if (variant === "icon") {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          containerSize,
          status === "completed" && "bg-green-100 dark:bg-green-900/50 text-green-600",
          status === "active" && (isQuiz ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600" : isAssignment ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600" : "bg-primary/10 text-primary"),
          status === "locked" && "bg-muted text-muted-foreground",
          status === "in-progress" && "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600",
          status === "not-started" && (isQuiz ? "text-amber-500" : isAssignment ? "text-blue-500" : "bg-muted text-muted-foreground"),
          className
        )}
      >
        {status === "completed" && <Check className={iconSize} />}
        {status === "active" && (getTypeIcon(iconSize) || <Play className={cn(iconSize, "fill-current ml-0.5")} />)}
        {status === "locked" && <Lock className={iconSize} />}
        {status === "in-progress" && (
          <>
            {getTypeIcon(iconSize) || <Circle className={iconSize} />}
            {/* Progress ring */}
            <svg
              className="absolute inset-0"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(progress! / 100) * 62.83} 62.83`}
                strokeLinecap="round"
                transform="rotate(-90 12 12)"
                className="text-yellow-500"
              />
            </svg>
          </>
        )}
        {status === "not-started" && (getTypeIcon(iconSize) || <Video className={cn(iconSize, "text-muted-foreground")} />)}
      </div>
    );
  }

  // Badge variant
  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          status === "completed" && "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
          status === "active" && "bg-primary/10 text-primary",
          status === "locked" && "bg-muted text-muted-foreground",
          status === "in-progress" && "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
          status === "not-started" && "bg-muted text-muted-foreground",
          className
        )}
      >
        {status === "completed" && (
          <>
            <Check className="h-3 w-3" />
            <span>Completed</span>
          </>
        )}
        {status === "active" && (
          <>
            <Play className="h-3 w-3 fill-current" />
            <span>Playing</span>
          </>
        )}
        {status === "locked" && (
          <>
            <Lock className="h-3 w-3" />
            <span>Locked</span>
          </>
        )}
        {status === "in-progress" && (
          <>
            <Circle className="h-3 w-3" />
            <span>{progress}%</span>
          </>
        )}
        {status === "not-started" && (
          <>
            <Circle className="h-3 w-3" />
            <span>Not started</span>
          </>
        )}
      </span>
    );
  }

  // Full variant - includes duration and more info
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Status Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          containerSize,
          status === "completed" && "bg-green-100 dark:bg-green-900/50 text-green-600",
          status === "active" && "bg-primary/10 text-primary",
          status === "locked" && "bg-muted text-muted-foreground",
          status === "in-progress" && "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600",
          status === "not-started" && "bg-muted text-muted-foreground"
        )}
      >
        {status === "completed" && <Check className={iconSize} />}
        {status === "active" && (getTypeIcon(iconSize) || <Play className={cn(iconSize, "fill-current ml-0.5")} />)}
        {status === "locked" && <Lock className={iconSize} />}
        {(status === "in-progress" || status === "not-started") && (
          getTypeIcon(iconSize) || <Video className={cn(iconSize, "text-muted-foreground")} />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        {/* Status Text */}
        <span
          className={cn(
            "text-xs",
            status === "completed" && "text-green-600",
            status === "active" && "text-primary",
            status === "locked" && "text-muted-foreground",
            status === "in-progress" && "text-yellow-600",
            status === "not-started" && "text-muted-foreground"
          )}
        >
          {status === "completed" && "Completed"}
          {status === "active" && "Now Playing"}
          {status === "locked" && "Locked"}
          {status === "in-progress" && `${progress}% complete`}
          {status === "not-started" && "Not started"}
        </span>

        {/* Duration */}
        {duration !== undefined && (
          <span className="text-xs text-muted-foreground">
            {formatDuration(duration)}
          </span>
        )}

        {/* Free Preview Badge */}
        {isFreePreview && !isLocked && (
          <span className="text-xs text-primary font-medium">Free Preview</span>
        )}
      </div>
    </div>
  );
}

export default LessonStatus;

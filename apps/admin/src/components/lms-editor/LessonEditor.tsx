"use client";

import { cn, Button, Input, Label, Textarea } from "@open-mtlms/core";
import type { LMSLesson } from "@open-mtlms/shared";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  Edit2,
  Video,
  FileText,
  HelpCircle,
  ClipboardCheck,
} from "lucide-react";
import { useState } from "react";

import { ResourceManager } from "./ResourceManager";
import { VideoConfigPanel } from "./VideoConfigPanel";

interface LessonEditorProps {
  lesson: LMSLesson;
  index: number;
  isActive?: boolean;
  onChange: (lesson: LMSLesson) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  className?: string;
}

export function LessonEditor({
  lesson,
  index,
  isActive = false,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  className,
}: LessonEditorProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const hasVideo = !!lesson.video?.videoId;
  const hasResources = lesson.resources && lesson.resources.length > 0;
  const normalizedType = lesson.lessonType?.toLowerCase();
  const isQuiz = normalizedType === "quiz";
  const isAssignment = normalizedType === "assignment";
  return (
    <div
      className={cn(
        "border rounded-lg transition-all",
        isExpanded ? "bg-card" : "bg-background",
        isActive && "ring-2 ring-primary",
        className
      )}
    >
      {/* Lesson Header */}
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />

        {/* Reorder Buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={!onMoveUp}
            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!onMoveDown}
            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Lesson Number */}
        <span className="text-sm text-muted-foreground w-6">
          {index + 1}.
        </span>

        {/* Lesson Title */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 text-left flex items-center gap-2"
        >
          <span className="font-medium truncate">
            {lesson.title || "Untitled Lesson"}
          </span>
          
          {/* Indicators */}
          <div className="flex items-center gap-1">
            {isQuiz && (
              <span className="p-1 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                <HelpCircle className="h-3 w-3" />
              </span>
            )}
            {isAssignment && (
              <span className="p-1 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600">
                <ClipboardCheck className="h-3 w-3" />
              </span>
            )}
            {!isQuiz && !isAssignment && hasVideo && (
              <span className="p-1 rounded bg-primary/10 text-primary">
                <Video className="h-3 w-3" />
              </span>
            )}
            {hasResources && (
              <span className="p-1 rounded bg-muted text-muted-foreground">
                <FileText className="h-3 w-3" />
              </span>
            )}
            {lesson.isFreePreview && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                Free
              </span>
            )}
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <Edit2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="border-t p-4 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Lesson Title</Label>
              <Input
                value={lesson.title}
                onChange={(e) => onChange({ ...lesson, title: e.target.value })}
                placeholder="Enter lesson title"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={lesson.description || ""}
              onChange={(e) => onChange({ ...lesson, description: e.target.value })}
              placeholder="Brief description of what this lesson covers"
              rows={3}
            />
          </div>

          {/* Free Preview Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`free-preview-${lesson.id}`}
              checked={lesson.isFreePreview || false}
              onChange={(e) =>
                onChange({ ...lesson, isFreePreview: e.target.checked })
              }
              className="rounded border-input"
            />
            <Label htmlFor={`free-preview-${lesson.id}`}>
              Available as free preview
            </Label>
          </div>

          {/* Video Configuration */}
          <VideoConfigPanel
            video={lesson.video}
            onChange={(video) => onChange({ ...lesson, video })}
          />

          {/* Resources (store-based lessons have no server IDs, legacy display only) */}
          <ResourceManager
            courseId={null}
            lessonId={null}
            legacyResources={lesson.resources || []}
            title="Lesson Resources"
          />
        </div>
      )}
    </div>
  );
}

export default LessonEditor;

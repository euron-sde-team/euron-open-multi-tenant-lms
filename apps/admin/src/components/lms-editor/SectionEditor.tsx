"use client";

import { cn, Button, Input } from "@open-mtlms/core";
import type { LMSSection, LMSLesson } from "@open-mtlms/shared";
import { createLMSLesson } from "@open-mtlms/shared";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";

import { LessonEditor } from "./LessonEditor";
import { ResourceManager } from "./ResourceManager";

interface SectionEditorProps {
  section: LMSSection;
  index: number;
  onChange: (section: LMSSection) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  className?: string;
}

export function SectionEditor({
  section,
  index: _index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  className,
}: SectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSectionResources, setShowSectionResources] = useState(false);

  const handleAddLesson = () => {
    const newLesson = createLMSLesson("", section.lessons.length);
    onChange({
      ...section,
      lessons: [...section.lessons, newLesson],
    });
  };

  const handleUpdateLesson = (lessonIndex: number, updatedLesson: LMSLesson) => {
    const newLessons = [...section.lessons];
    newLessons[lessonIndex] = updatedLesson;
    onChange({ ...section, lessons: newLessons });
  };

  const handleRemoveLesson = (lessonIndex: number) => {
    onChange({
      ...section,
      lessons: section.lessons.filter((_, i) => i !== lessonIndex),
    });
  };

  const handleMoveLesson = (lessonIndex: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
    if (newIndex < 0 || newIndex >= section.lessons.length) return;

    const newLessons = [...section.lessons];
    [newLessons[lessonIndex], newLessons[newIndex]] = [
      newLessons[newIndex],
      newLessons[lessonIndex],
    ];

    // Update order values
    newLessons.forEach((l, i) => {
      l.order = i;
    });

    onChange({ ...section, lessons: newLessons });
  };

  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", className)}>
      {/* Section Header */}
      <div className="flex items-center gap-2 p-4 bg-muted/30">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />

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

        <FolderOpen className="h-5 w-5 text-muted-foreground" />

        {/* Section Title Input */}
        <div className="flex-1">
          <Input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Section title"
            className="font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
          />
          <span className="text-xs text-muted-foreground">
            {section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSectionResources(!showSectionResources)}
          >
            Resources
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
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

      {/* Section Resources (collapsible) */}
      {showSectionResources && (
        <div className="border-t p-4 bg-muted/10">
          <ResourceManager
            courseId={null}
            lessonId={null}
            legacyResources={section.resources || []}
            title="Section Resources (shared across all lessons)"
          />
        </div>
      )}

      {/* Lessons */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {section.lessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No lessons in this section</p>
              <Button onClick={handleAddLesson} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add First Lesson
              </Button>
            </div>
          ) : (
            <>
              {section.lessons.map((lesson, lessonIndex) => (
                <LessonEditor
                  key={lesson.id}
                  lesson={lesson}
                  index={lessonIndex}
                  onChange={(updated) => handleUpdateLesson(lessonIndex, updated)}
                  onRemove={() => handleRemoveLesson(lessonIndex)}
                  onMoveUp={
                    lessonIndex > 0
                      ? () => handleMoveLesson(lessonIndex, "up")
                      : undefined
                  }
                  onMoveDown={
                    lessonIndex < section.lessons.length - 1
                      ? () => handleMoveLesson(lessonIndex, "down")
                      : undefined
                  }
                />
              ))}
              <Button
                onClick={handleAddLesson}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SectionEditor;

"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  cn,
} from "@open-mtlms/core";
import { createCourseRecommendation } from "@open-mtlms/shared";
import { BookOpen, GripVertical, Trash2, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { coursesLmsApi } from "@/lib/api/courses-lms";
import { useCourseStore } from "@/lib/stores/course-store";
import type { LMSCourse } from "@/lib/types/course-lms";

interface CourseRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourseRecommendationModal({ open, onOpenChange }: CourseRecommendationModalProps) {
  const { courseData, addRecommendation, removeRecommendation, reorderRecommendations } =
    useCourseStore();
  const [courses, setCourses] = useState<LMSCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  const recommendations = courseData.recommendations || [];
  const currentSlug = (courseData.slug ?? "").replace(/^courses\//, "").toLowerCase();

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coursesLmsApi.getCourses({ page: 1, limit: 200 });
      setCourses(res.courses || []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchCourses();
  }, [open, fetchCourses]);

  const availableCourses = courses.filter(
    (c) => (c.slug ?? "").toLowerCase() !== currentSlug && !recommendations.some((r) => r.courseId === c.id)
  );

  const handleAddCourse = (course: LMSCourse) => {
    addRecommendation(
      createCourseRecommendation(
        course.id,
        course.title,
        course.slug,
        course.thumbnailUrl || undefined,
        recommendations.length
      )
    );
    setPickerOpen(false);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) reorderRecommendations(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < recommendations.length - 1) reorderRecommendations(index, index + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Recommendations
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Recommend related courses to students viewing this course
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-2">
          {/* Add course picker */}
          <div className="relative" ref={pickerRef}>
            <Label className="mb-2 block">Add recommended course</Label>
            <Button
              variant="outline"
              className="w-full justify-between border-dashed"
              onClick={() => setPickerOpen(!pickerOpen)}
              disabled={loading || availableCourses.length === 0}
            >
              <span>
                {loading
                  ? "Loading courses..."
                  : availableCourses.length === 0
                    ? "No more courses to add"
                    : "Select a course to recommend"}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", pickerOpen && "rotate-180")}
              />
            </Button>
            {pickerOpen && availableCourses.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg z-10">
                {availableCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted transition-colors"
                    onClick={() => handleAddCourse(course)}
                  >
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt=""
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{course.title}</p>
                      <p className="text-xs text-muted-foreground">{course.slug}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations list */}
          <div className="space-y-2">
            <Label>Recommended courses ({recommendations.length})</Label>
            {recommendations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recommendations yet</p>
                <p className="text-sm">Add courses to show as recommendations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div
                    key={rec.id}
                    className="group flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <span className="text-xs">↑</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === recommendations.length - 1}
                      >
                        <span className="text-xs">↓</span>
                      </Button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {rec.thumbnailUrl ? (
                      <img
                        src={rec.thumbnailUrl}
                        alt=""
                        className="h-14 w-14 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{rec.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{rec.slug}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => removeRecommendation(rec.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            {recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { useCallback, useState } from "react";

import { SlugEditor } from "@/components/shared/slug-editor";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { availableRoutesKeys } from "@/lib/hooks/use-available-routes";
import { courseKeys } from "@/lib/hooks/use-courses";
import { COURSES_LMS_QUERY_KEY } from "@/lib/hooks/use-infinite-courses-lms";
import { pageKeys } from "@/lib/hooks/use-pages";
import { useCourseStore } from "@/lib/stores/course-store";
import { extractCourseSlug } from "@/lib/utils/slug";

interface CourseUrlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** LMS course id; null until the course has been saved once. */
  lmsCourseId: string | null;
  /** Lock the URL while the editor is saving the course. */
  disabled?: boolean;
}

/**
 * Change the course URL on its own: the backend renames the course slug and
 * its landing page (courses/<slug>) together.
 */
export function CourseUrlModal({
  open,
  onOpenChange,
  lmsCourseId,
  disabled = false,
}: CourseUrlModalProps) {
  const queryClient = useQueryClient();
  const pageSlug = useCourseStore((s) => s.courseData.slug);
  const title = useCourseStore((s) => s.courseData.title);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(
    async (slug: string): Promise<string> => {
      if (!lmsCourseId) {
        throw new Error("Save the course once before changing its URL");
      }
      setSaving(true);
      try {
        const updated = await coursesLmsApi.updateCourse(lmsCourseId, { slug });
        const saved = updated.slug || slug;
        const nextPageSlug = `courses/${saved}`;
        // The main Save sends the slug every time, so the store must hold the
        // new one. Undo snapshots follow too, so undo cannot bring the old URL
        // back. Not an edit: no dirty flag, no undo step.
        useCourseStore.setState((s) => ({
          courseData: { ...s.courseData, slug: nextPageSlug },
          history: {
            past: s.history.past.map((d) => ({ ...d, slug: nextPageSlug })),
            future: s.history.future.map((d) => ({ ...d, slug: nextPageSlug })),
          },
        }));
        void queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: COURSES_LMS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
        void queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [lmsCourseId, queryClient]
  );

  return (
    <Dialog
      open={open}
      // Stay open until a save settles, so the main Save never runs on the old URL.
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Course URL
          </DialogTitle>
          <DialogDescription>
            {lmsCourseId
              ? "The address of this course page on your website."
              : "Save the course once before changing its URL."}
          </DialogDescription>
        </DialogHeader>
        <SlugEditor
          basePath="/courses/"
          value={extractCourseSlug(pageSlug)}
          title={title}
          noun="course"
          onSave={handleSave}
          disabled={disabled}
        />
      </DialogContent>
    </Dialog>
  );
}

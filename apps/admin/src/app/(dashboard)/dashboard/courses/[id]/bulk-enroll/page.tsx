"use client";

import { Button } from "@open-mtlms/core";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BulkImportPage } from "../../../../../../components/bulk-import/BulkImportPage";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { useEligibleBatches } from "@/lib/hooks/use-bulk-imports";

interface ResolvedCourse {
  id: string;
  title: string;
  mode: string;
}

export default function CourseBulkEnrollPage() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id ?? "";
  const [course, setCourse] = useState<ResolvedCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const batchesQuery = useEligibleBatches(course ? course.id : null);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) return;
    (async () => {
      try {
        const found = await coursesLmsApi.getCourse(courseId);
        if (!found) throw new Error("Course not found");
        if (!cancelled) {
          setCourse({ id: found.id, title: found.title, mode: found.mode });
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to resolve course");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/courses">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to courses
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Bulk add students</h1>
        </div>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!course && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Resolving course...
          </div>
        )}

        {course && (
          <BulkImportPage
            scope="COURSE"
            courseId={course.id}
            contextTitle={course.title}
            contextSubtitle={`Mode: ${course.mode}. New and reactivated enrollments use the selected validity; existing active enrollments are never modified.`}
            availableBatches={(batchesQuery.data ?? []).map((b) => ({
              id: b.id,
              title: b.title,
            }))}
          />
        )}
      </div>
    </>
  );
}

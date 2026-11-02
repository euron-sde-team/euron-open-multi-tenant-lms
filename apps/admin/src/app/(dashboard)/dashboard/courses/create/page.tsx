"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CreateCoursePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new course editor
    router.replace("/course-editor/new");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Redirecting to course editor...</p>
      </div>
    </div>
  );
}

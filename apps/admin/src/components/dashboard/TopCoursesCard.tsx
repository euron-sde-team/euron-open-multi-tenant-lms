"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import { Trophy } from "lucide-react";

import type { TopCourse } from "../../lib/types/dashboard";

interface TopCoursesCardProps {
  courses: TopCourse[];
}

function modeLabel(mode: string): string {
  const map: Record<string, string> = {
    SELF_PACED: "Self-paced",
    LIVE: "Live",
    HYBRID: "Hybrid",
  };
  return map[mode] ?? mode;
}

export function TopCoursesCard({ courses }: TopCoursesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Top Courses
        </CardTitle>
        <CardDescription>Most enrolled published courses</CardDescription>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No published courses yet
          </p>
        ) : (
          <div className="space-y-3">
            {courses.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {modeLabel(c.mode)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.enrollment_count}{" "}
                      {c.enrollment_count === 1 ? "student" : "students"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

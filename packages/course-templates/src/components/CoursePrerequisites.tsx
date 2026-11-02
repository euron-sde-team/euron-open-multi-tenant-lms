"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

interface CoursePrerequisitesProps {
  prerequisites: string[];
  className?: string;
  title?: string;
}

export function CoursePrerequisites({
  prerequisites,
  className,
  title = "Requirements",
}: CoursePrerequisitesProps) {
  return (
    <section
      className={cn("rounded-xl border p-6", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <h2
        className="text-xl font-bold mb-6"
        style={{ color: "hsl(var(--card-foreground))" }}
      >
        {title}
      </h2>
      {prerequisites.length === 0 ? (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          No prerequisites - suitable for beginners
        </p>
      ) : (
        <div className="space-y-2">
          {prerequisites.map((prerequisite, index) => (
            <div key={index} className="flex items-start gap-3 py-2">
              <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--primary))" }} />
              <span className="text-sm" style={{ color: "hsl(var(--card-foreground))" }}>
                {prerequisite}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

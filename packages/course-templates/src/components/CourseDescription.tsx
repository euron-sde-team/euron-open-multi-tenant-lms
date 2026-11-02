"use client";

import { cn } from "../lib/utils";

interface CourseDescriptionProps {
  description: string;
  className?: string;
  title?: string;
}

export function CourseDescription({
  description,
  className,
  title = "Description",
}: CourseDescriptionProps) {
  if (!description) {
    return null;
  }

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
      <div
        className="text-sm leading-relaxed whitespace-pre-wrap"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        {description}
      </div>
    </section>
  );
}

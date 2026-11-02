"use client";

import { Video, Package, Check } from "lucide-react";
import type { CourseOfferingData } from "@open-mtlms/shared";
import { cn } from "../lib/utils";

interface CourseOfferingsProps {
  offerings: CourseOfferingData[];
  className?: string;
  variant?: "card" | "grid" | "list";
  title?: string;
}

export function CourseOfferings({
  offerings,
  className,
  variant = "card",
  title = "This Course Includes",
}: CourseOfferingsProps) {
  if (offerings.length === 0) {
    return null;
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)}>
        {offerings.map((offering) => (
          <div key={offering.id} className="flex items-center gap-3">
            <Check className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {offering.text}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", className)}>
        {offerings.map((offering) => (
          <div key={offering.id} className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              <Video className="h-5 w-5" />
            </div>
            <span className="text-sm" style={{ color: "hsl(var(--card-foreground))" }}>
              {offering.text}
            </span>
          </div>
        ))}
      </div>
    );
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
        className="text-xl font-bold mb-6 flex items-center gap-2"
        style={{ color: "hsl(var(--card-foreground))" }}
      >
        <Package className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {offerings.map((offering) => (
          <div key={offering.id} className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              <Video className="h-5 w-5" />
            </div>
            <span className="text-sm" style={{ color: "hsl(var(--card-foreground))" }}>
              {offering.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

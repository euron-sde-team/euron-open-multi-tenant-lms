"use client";

import { formatNumber } from "@open-mtlms/shared";
import { BookOpen, Star, User, Users } from "lucide-react";
import { cn } from "../lib/utils";

export interface InstructorData {
  id: string;
  name: string;
  role: string;
  company?: string;
  avatar?: string;
  bio?: string;
  rating?: number;
  students?: number;
  courses?: number;
}

interface CourseInstructorsProps {
  instructors: InstructorData[];
  className?: string;
  variant?: "card" | "compact" | "detailed";
  title?: string;
}

export function CourseInstructors({
  instructors,
  className,
  variant = "card",
  title,
}: CourseInstructorsProps) {
  const sectionTitle =
    title || (instructors.length === 1 ? "Meet Your Instructor" : " Meet Your Instructors");

  if (instructors.length === 0) {
    return (
      <section
        className={cn("rounded-xl border p-6", className)}
        style={{
          backgroundColor: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <h2
          className="mb-6 flex items-center gap-2 text-xl font-bold"
          style={{ color: "hsl(var(--card-foreground))" }}
        >
          <User className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
          {sectionTitle}
        </h2>
        <div className="py-8 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
          <User className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No instructors assigned</p>
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn("rounded-xl border p-6", className)}
        style={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <h3 className="mb-4 font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
          {instructors.length === 1 ? "Instructor" : "Instructors"}
        </h3>
        <div className="space-y-4">
          {instructors.map((instructor) => (
            <div key={instructor.id} className="flex gap-3">
              {instructor.avatar ? (
                <img
                  src={instructor.avatar}
                  alt={instructor.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "hsl(var(--muted))" }}
                >
                  <User className="h-6 w-6" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                  {instructor.name}
                </p>
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {instructor.role}
                </p>
                {instructor.rating && (
                  <div className="mt-1 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {instructor.rating}{" "}
                      {instructor.students && `• ${formatNumber(instructor.students)} students`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <section className={className}>
        <h2 className="mb-8 text-2xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
          Meet your instructor{instructors.length > 1 ? "s" : ""}
        </h2>
        <div className="space-y-8">
          {instructors.map((instructor) => (
            <div key={instructor.id} className="flex flex-col items-start gap-6 sm:flex-row">
              {instructor.avatar ? (
                <img
                  src={instructor.avatar}
                  alt={instructor.name}
                  className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "hsl(var(--muted))" }}
                >
                  <User className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              )}
              <div>
                <h3
                  className="text-xl font-semibold"
                  style={{ color: "hsl(var(--card-foreground))" }}
                >
                  {instructor.name}
                </h3>
                <p className="mb-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {instructor.role} {instructor.company && `at ${instructor.company}`}
                </p>
                <div
                  className="mb-4 flex items-center gap-4 text-sm"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {instructor.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      {instructor.rating} rating
                    </span>
                  )}
                  {instructor.students && (
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {formatNumber(instructor.students)} students
                    </span>
                  )}
                </div>
                {instructor.bio && (
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {instructor.bio}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Default card variant
  return (
    <section
      className={cn("rounded-xl border p-6", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <h2
        className="mb-6 flex items-center gap-2 text-xl font-bold"
        style={{ color: "hsl(var(--card-foreground))" }}
      >
        <User className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
        {sectionTitle}
      </h2>
      <div className="space-y-6">
        {instructors.map((instructor) => (
          <div key={instructor.id} className="flex gap-4">
            {instructor.avatar ? (
              <img
                src={instructor.avatar}
                alt={instructor.name}
                className="h-20 w-20 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "hsl(var(--muted))" }}
              >
                <User className="h-8 w-8" style={{ color: "hsl(var(--muted-foreground))" }} />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                {instructor.name}
              </h4>
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                {instructor.role} {instructor.company && `at ${instructor.company}`}
              </p>
              <div
                className="mt-2 flex items-center gap-4 text-xs"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {instructor.rating && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {instructor.rating}
                  </span>
                )}
                {instructor.students && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatNumber(instructor.students)} students
                  </span>
                )}
                {instructor.courses && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {instructor.courses} courses
                  </span>
                )}
              </div>
              {instructor.bio && (
                <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {instructor.bio}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

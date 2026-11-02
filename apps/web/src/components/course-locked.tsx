"use client";

import { decodeHtmlEntities } from "@open-mtlms/shared";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

interface CourseLockedProps {
  /** The course they tried to open. */
  title: string;
  /** The course they must finish first. */
  blockedBy: {
    title: string;
    slug: string;
    done: number;
    total: number;
  };
}

/**
 * SEQUENTIAL COURSES, what a learner sees when a course is locked behind
 * another one.
 *
 * Deliberately NOT <AccessDenied>. That screen says "you need to enrol" and
 * auto-redirects to the sales page after 5 seconds, which is right for someone
 * who hasn't bought the course, and exactly wrong here. This learner HAS bought
 * it. Sending them to buy it again explains nothing and offers no way forward.
 *
 * So: no redirect, no countdown. Name the course that's blocking them, show how
 * far through it they are, and make the one button go to the thing that actually
 * unlocks this, the prerequisite.
 */
export function CourseLocked({ title, blockedBy }: CourseLockedProps) {
  // Titles arrive HTML-encoded from the API ("… &amp; …"); decode for display.
  const courseTitle = decodeHtmlEntities(title);
  const blockerTitle = decodeHtmlEntities(blockedBy.title);
  const { done, total } = blockedBy;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-background flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4">
      <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
        <Lock className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">
          Finish the previous course first
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <span className="text-foreground font-medium">{courseTitle}</span>{" "}
          opens as
          soon as you complete{" "}
          <span className="text-foreground font-medium">{blockerTitle}</span>.
        </p>
      </div>

      {/* Only shown when we actually know the numbers. "0 of 0" would be worse
          than saying nothing. */}
      {total > 0 && (
        <div className="w-full max-w-xs">
          <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
            <span>{blockerTitle}</span>
            <span>
              {done} of {total}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <Link
        href={`/learn/${blockedBy.slug}`}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
      >
        {done > 0 ? "Continue" : "Start"} {blockerTitle}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default CourseLocked;

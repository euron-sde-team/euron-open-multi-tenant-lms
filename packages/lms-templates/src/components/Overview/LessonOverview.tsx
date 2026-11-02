"use client";

import React from "react";
import { Video, FileText, Play, BookOpen } from "lucide-react";
import type { LMSLesson } from "../../types";
import { cn } from "../../lib/utils";
import ReactMarkdown from "react-markdown";

interface LessonOverviewProps {
  /** Lesson data */
  lesson: LMSLesson;
  /** Additional class name */
  className?: string;
}

export function LessonOverview({
  lesson,
  className,
}: LessonOverviewProps) {
  const hasVideo = lesson.video?.videoId;
  const hasResources = lesson.resources && lesson.resources.length > 0;
  const showLessonOverview = true;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Lesson Type Indicators & Overview */}
      {showLessonOverview && (
        <>
          {/* Lesson Type Indicators */}
          <div className="flex items-center gap-3 flex-wrap">
            {hasVideo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                <Video className="h-4 w-4" />
                <span>Video Lesson</span>
              </div>
            )}
            {hasResources && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                <FileText className="h-4 w-4" />
                <span>{lesson.resources.length} Resources</span>
              </div>
            )}
            {lesson.isFreePreview && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-sm">
                <Play className="h-4 w-4" />
                <span>Free Preview</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Lesson Overview / About this lesson */}
      {showLessonOverview && (
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-primary underline underline-offset-8 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              About this lesson
            </h3>
          </div>
          {lesson.description ? (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-3 text-foreground/80">{children}</p>,
                    h1: ({ children }) => (
                      <h1 className="mb-2 text-xl font-bold">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-2 text-lg font-semibold">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-2 text-base font-semibold">{children}</h3>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-3 ml-4 list-disc">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-3 ml-4 list-decimal">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children }) => (
                      <code className="rounded bg-primary/10 px-1.5 py-0.5 text-sm text-primary">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-sm">
                        {children}
                      </pre>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                  }}
                >
                  {lesson.description}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground italic">
                No description added yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LessonOverview;

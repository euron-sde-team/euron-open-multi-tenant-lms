"use client";

import React from "react";
import {
  Clock,
  BookOpen,
  Users,
  Award,
  CheckCircle,
  Globe,
  Calendar,
} from "lucide-react";
import type { LMSCourseData } from "../../types";
import { ProgressBar } from "../Progress/ProgressBar";
import { cn, formatDuration, decodeHtmlEntities } from "../../lib/utils";

interface CourseOverviewProps {
  /** Course data */
  courseData: LMSCourseData;
  /** Overall progress percentage */
  progress?: number;
  /** Number of completed lessons */
  completedLessons?: number;
  /** Instructors data */
  instructors?: Array<{
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  }>;
  /** Additional class name */
  className?: string;
}

export function CourseOverview({
  courseData,
  progress = 0,
  completedLessons = 0,
  instructors = [],
  className,
}: CourseOverviewProps) {
  const { course, sections, settings } = courseData;

  // Calculate totals
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalSections = sections.length;
  const totalDuration = sections.reduce((acc, section) => {
    return (
      acc +
      section.lessons.reduce((lessonAcc, lesson) => {
        const duration = lesson.duration ? parseInt(lesson.duration) || 0 : 0;
        return lessonAcc + duration;
      }, 0)
    );
  }, 0);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Course Header */}
      <div>
        <h1 className="text-2xl font-bold">{decodeHtmlEntities(course.title)}</h1>
        {course.subTitle && (
          <p className="text-muted-foreground mt-1">{decodeHtmlEntities(course.subTitle)}</p>
        )}
      </div>

      {/* Progress Section */}
      {settings.enableProgress && (
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-medium mb-3">Your Progress</h3>
          <ProgressBar
            value={progress}
            showLabel
            labelPosition="top"
            size="lg"
          />
          <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
            <span>
              {completedLessons} of {totalLessons} lessons completed
            </span>
            {progress >= 100 && settings.enableCertificate && (
              <span className="text-green-600 flex items-center gap-1">
                <Award className="h-4 w-4" />
                Certificate earned!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Course Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm">Lessons</span>
          </div>
          <p className="text-2xl font-semibold">{totalLessons}</p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Duration</span>
          </div>
          <p className="text-2xl font-semibold">
            {totalDuration > 0 ? formatDuration(totalDuration) : course.duration || "N/A"}
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Globe className="h-4 w-4" />
            <span className="text-sm">Language</span>
          </div>
          <p className="text-2xl font-semibold">{course.language}</p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Sections</span>
          </div>
          <p className="text-2xl font-semibold">{totalSections}</p>
        </div>
      </div>

      {/* Description */}
      {course.description && (
        <div>
          <h3 className="font-medium mb-2">About this course</h3>
          <p className="text-foreground/80 whitespace-pre-wrap">
            {decodeHtmlEntities(course.description)}
          </p>
        </div>
      )}

      {/* Learning Outcomes */}
      {course.learningOutcomes && course.learningOutcomes.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">What you&apos;ll learn</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {course.learningOutcomes.map((outcome, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{decodeHtmlEntities(outcome)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prerequisites */}
      {course.prerequisites && course.prerequisites.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">Prerequisites</h3>
          <ul className="space-y-2">
            {course.prerequisites.map((prereq, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">•</span>
                <span>{decodeHtmlEntities(prereq)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructors */}
      {instructors.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">Instructors</h3>
          <div className="flex flex-wrap gap-4">
            {instructors.map((instructor) => (
              <div
                key={instructor.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                {instructor.avatar ? (
                  <img
                    src={instructor.avatar}
                    alt={decodeHtmlEntities(instructor.name)}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{decodeHtmlEntities(instructor.name)}</p>
                  {instructor.role && (
                    <p className="text-sm text-muted-foreground">
                      {decodeHtmlEntities(instructor.role)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseOverview;

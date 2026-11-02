"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  LMSCallbacks,
  LMSCourseData,
  LMSLesson,
  LMSRating,
  LMSRatingSummary,
  LMSSection,
  LMSSettings,
} from "../types";

// ============================================================================
// LMS Data Context
// ============================================================================

interface LMSDataContextValue {
  /** Full course data */
  courseData: LMSCourseData;
  /** Current lesson being viewed */
  currentLesson: LMSLesson | null;
  /** Current section */
  currentSection: LMSSection | null;
  /** All lessons flattened */
  allLessons: LMSLesson[];
  /** LMS settings */
  settings: LMSSettings;
  /** Set current lesson */
  setCurrentLesson: (lessonId: string) => void;
  /** Get next lesson */
  getNextLesson: () => LMSLesson | null;
  /** Get previous lesson */
  getPreviousLesson: () => LMSLesson | null;
  /** Check if lesson is first */
  isFirstLesson: () => boolean;
  /** Check if lesson is last */
  isLastLesson: () => boolean;
}

const LMSDataContext = createContext<LMSDataContextValue | null>(null);

// ============================================================================
// LMS Edit Context
// ============================================================================

interface LMSEditContextValue {
  /** Whether in edit mode */
  isEditMode: boolean;
  /** Callbacks for edit actions */
  callbacks: LMSCallbacks;
}

const LMSEditContext = createContext<LMSEditContextValue | null>(null);


// ============================================================================
// LMS Ratings Context
// ============================================================================

interface LMSRatingsContextValue {
  /** Course ratings */
  courseRatings: LMSRating[];
  /** Course rating summary */
  courseSummary: LMSRatingSummary | null;
  /** Lesson ratings (if enabled) */
  lessonRatings: LMSRating[];
  /** Loading state */
  isLoading: boolean;
  /** Submit course rating */
  submitCourseRating: (rating: number, review?: string) => Promise<void>;
  /** Submit lesson rating */
  submitLessonRating: (rating: number, review?: string) => Promise<void>;
  /** Current user's course rating */
  userCourseRating: LMSRating | null;
  /** Current user's lesson rating */
  userLessonRating: LMSRating | null;
}

const LMSRatingsContext = createContext<LMSRatingsContextValue | null>(null);

// ============================================================================
// Providers
// ============================================================================

interface LMSDataProviderProps {
  children: React.ReactNode;
  courseData: LMSCourseData;
  initialLessonId?: string;
}

export function LMSDataProvider({ children, courseData, initialLessonId }: LMSDataProviderProps) {
  // Flatten all lessons
  const allLessons = useMemo(() => {
    return courseData.sections.flatMap((section) => section.lessons);
  }, [courseData.sections]);

  // Find initial lesson
  const initialLesson = useMemo(() => {
    if (initialLessonId) {
      return allLessons.find((l) => l.id === initialLessonId) || allLessons[0] || null;
    }
    return allLessons[0] || null;
  }, [allLessons, initialLessonId]);

  const [currentLesson, setCurrentLessonState] = useState<LMSLesson | null>(initialLesson);

  // Find current section
  const currentSection = useMemo(() => {
    if (!currentLesson) return null;
    return (
      courseData.sections.find((section) =>
        section.lessons.some((l) => l.id === currentLesson.id)
      ) || null
    );
  }, [courseData.sections, currentLesson]);

  const setCurrentLesson = useCallback(
    (lessonId: string) => {
      const lesson = allLessons.find((l) => l.id === lessonId);
      if (lesson) {
        setCurrentLessonState(lesson);
      }
    },
    [allLessons]
  );

  const currentIndex = useMemo(() => {
    if (!currentLesson) return -1;
    return allLessons.findIndex((l) => l.id === currentLesson.id);
  }, [allLessons, currentLesson]);

  const getNextLesson = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= allLessons.length - 1) return null;
    return allLessons[currentIndex + 1];
  }, [allLessons, currentIndex]);

  const getPreviousLesson = useCallback(() => {
    if (currentIndex <= 0) return null;
    return allLessons[currentIndex - 1];
  }, [allLessons, currentIndex]);

  const isFirstLesson = useCallback(() => {
    return currentIndex === 0;
  }, [currentIndex]);

  const isLastLesson = useCallback(() => {
    return currentIndex === allLessons.length - 1;
  }, [allLessons.length, currentIndex]);

  const value: LMSDataContextValue = {
    courseData,
    currentLesson,
    currentSection,
    allLessons,
    settings: courseData.settings,
    setCurrentLesson,
    getNextLesson,
    getPreviousLesson,
    isFirstLesson,
    isLastLesson,
  };

  return <LMSDataContext.Provider value={value}>{children}</LMSDataContext.Provider>;
}

interface LMSEditProviderProps {
  children: React.ReactNode;
  isEditMode?: boolean;
  callbacks?: LMSCallbacks;
}

export function LMSEditProvider({
  children,
  isEditMode = false,
  callbacks = {},
}: LMSEditProviderProps) {
  const value: LMSEditContextValue = {
    isEditMode,
    callbacks,
  };

  return <LMSEditContext.Provider value={value}>{children}</LMSEditContext.Provider>;
}

interface LMSRatingsProviderProps {
  children: React.ReactNode;
  courseId: string;
  lessonId?: string;
  userId?: string;
  onSubmitCourseRating?: (rating: number, review?: string) => Promise<void>;
  onSubmitLessonRating?: (rating: number, review?: string) => Promise<void>;
  initialCourseRatings?: LMSRating[];
  initialCourseSummary?: LMSRatingSummary;
  initialLessonRatings?: LMSRating[];
}

export function LMSRatingsProvider({
  children,
  courseId,
  lessonId,
  userId,
  onSubmitCourseRating,
  onSubmitLessonRating,
  initialCourseRatings = [],
  initialCourseSummary,
  initialLessonRatings = [],
}: LMSRatingsProviderProps) {
  const [courseRatings] = useState<LMSRating[]>(initialCourseRatings);
  const [courseSummary] = useState<LMSRatingSummary | null>(
    initialCourseSummary || null
  );
  const [lessonRatings] = useState<LMSRating[]>(initialLessonRatings);
  const [isLoading, setIsLoading] = useState(false);

  const userCourseRating = useMemo(() => {
    if (!userId) return null;
    return courseRatings.find((r) => r.userId === userId) || null;
  }, [courseRatings, userId]);

  const userLessonRating = useMemo(() => {
    if (!userId) return null;
    return lessonRatings.find((r) => r.userId === userId) || null;
  }, [lessonRatings, userId]);

  const submitCourseRating = useCallback(
    async (rating: number, review?: string) => {
      if (onSubmitCourseRating) {
        setIsLoading(true);
        try {
          await onSubmitCourseRating(rating, review);
          // In real implementation, refresh ratings from API
        } catch (err) {
          console.error("Failed to submit course rating", err);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [onSubmitCourseRating]
  );

  const submitLessonRating = useCallback(
    async (rating: number, review?: string) => {
      if (onSubmitLessonRating) {
        setIsLoading(true);
        try {
          await onSubmitLessonRating(rating, review);
          // In real implementation, refresh ratings from API
        } catch (err) {
          console.error("Failed to submit lesson rating", err);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [onSubmitLessonRating]
  );

  const value: LMSRatingsContextValue = {
    courseRatings,
    courseSummary,
    lessonRatings,
    isLoading,
    submitCourseRating,
    submitLessonRating,
    userCourseRating,
    userLessonRating,
  };

  return <LMSRatingsContext.Provider value={value}>{children}</LMSRatingsContext.Provider>;
}

// ============================================================================
// Combined Provider
// ============================================================================

interface LMSProviderProps {
  children: React.ReactNode;
  courseData: LMSCourseData;
  initialLessonId?: string;
  isEditMode?: boolean;
  callbacks?: LMSCallbacks;
  currentUser?: {
    id: string;
    name: string;
    avatar?: string;
    isInstructor: boolean;
  };
}

export function LMSProvider({
  children,
  courseData,
  initialLessonId,
  isEditMode = false,
  callbacks = {},
  currentUser,
}: LMSProviderProps) {
  return (
    <LMSDataProvider courseData={courseData} initialLessonId={initialLessonId}>
      <LMSEditProvider isEditMode={isEditMode} callbacks={callbacks}>
        {children}
      </LMSEditProvider>
    </LMSDataProvider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useLMSData() {
  const context = useContext(LMSDataContext);
  if (!context) {
    throw new Error("useLMSData must be used within an LMSDataProvider");
  }
  return context;
}

export function useLMSEdit() {
  const context = useContext(LMSEditContext);
  if (!context) {
    throw new Error("useLMSEdit must be used within an LMSEditProvider");
  }
  return context;
}

export function useIsLMSEditMode() {
  const context = useContext(LMSEditContext);
  return context?.isEditMode ?? false;
}

export function useLMSRatings() {
  const context = useContext(LMSRatingsContext);
  if (!context) {
    throw new Error("useLMSRatings must be used within an LMSRatingsProvider");
  }
  return context;
}

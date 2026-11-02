"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LMSCourseProgress, LMSLessonProgress } from "../types";

// ============================================================================
// Progress Context
// ============================================================================

interface LMSProgressContextValue {
  /** Course progress data */
  progress: LMSCourseProgress | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Check if a lesson is completed */
  isLessonCompleted: (lessonId: string) => boolean;
  /** Get lesson progress */
  getLessonProgress: (lessonId: string) => LMSLessonProgress | null;
  /** Mark lesson as complete */
  markLessonComplete: (lessonId: string) => Promise<void>;
  /** Update video progress */
  updateVideoProgress: (lessonId: string, seconds: number, total?: number) => void;
  /** Get overall progress percentage */
  getProgressPercent: () => number;
  /** Get completed lessons count */
  getCompletedCount: () => number;
  /** Get total lessons count */
  getTotalCount: () => number;
}

const LMSProgressContext = createContext<LMSProgressContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface LMSProgressProviderProps {
  children: React.ReactNode;
  courseId: string;
  totalLessons: number;
  initialProgress?: LMSCourseProgress;
  onMarkComplete?: (lessonId: string) => Promise<void>;
  onVideoProgress?: (lessonId: string, seconds: number) => void;
  /** Storage key for local persistence */
  storageKey?: string;
}

export function LMSProgressProvider({
  children,
  courseId,
  totalLessons,
  initialProgress,
  onMarkComplete,
  onVideoProgress,
  storageKey,
}: LMSProgressProviderProps) {
  const [progress, setProgress] = useState<LMSCourseProgress | null>(() => {
    // Try to load from localStorage if storageKey provided
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to load progress from storage", e);
      }
    }

    return (
      initialProgress || {
        courseId,
        totalLessons,
        completedLessons: 0,
        progressPercent: 0,
        lessonProgress: [],
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      }
    );
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save to localStorage when progress changes
  useEffect(() => {
    if (storageKey && progress && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(progress));
      } catch (e) {
        console.error("Failed to save progress to storage", e);
      }
    }
  }, [progress, storageKey]);

  const isLessonCompleted = useCallback(
    (lessonId: string) => {
      if (!progress) return false;
      const lessonProgress = progress.lessonProgress.find((p) => p.lessonId === lessonId);
      return lessonProgress?.completed ?? false;
    },
    [progress]
  );

  const getLessonProgress = useCallback(
    (lessonId: string): LMSLessonProgress | null => {
      if (!progress) return null;
      return progress.lessonProgress.find((p) => p.lessonId === lessonId) || null;
    },
    [progress]
  );

  const markLessonComplete = useCallback(
    async (lessonId: string) => {
      if (!progress) return;

      // Check if already completed
      if (isLessonCompleted(lessonId)) return;

      setIsLoading(true);
      setError(null);

      try {
        // Call external handler if provided
        if (onMarkComplete) {
          await onMarkComplete(lessonId);
        }

        // Update local state
        setProgress((prev) => {
          if (!prev) return prev;

          const existingIndex = prev.lessonProgress.findIndex((p) => p.lessonId === lessonId);

          const newLessonProgress: LMSLessonProgress = {
            lessonId,
            completed: true,
            completedAt: new Date().toISOString(),
          };

          let updatedLessonProgress: LMSLessonProgress[];
          if (existingIndex >= 0) {
            updatedLessonProgress = [...prev.lessonProgress];
            updatedLessonProgress[existingIndex] = {
              ...updatedLessonProgress[existingIndex],
              ...newLessonProgress,
            };
          } else {
            updatedLessonProgress = [...prev.lessonProgress, newLessonProgress];
          }

          const completedCount = updatedLessonProgress.filter((p) => p.completed).length;

          return {
            ...prev,
            lessonProgress: updatedLessonProgress,
            completedLessons: completedCount,
            progressPercent: Math.round((completedCount / prev.totalLessons) * 100),
            lastAccessedAt: new Date().toISOString(),
          };
        });
      } catch (err) {
        setError("Failed to mark lesson as complete");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [progress, isLessonCompleted, onMarkComplete]
  );

  const updateVideoProgress = useCallback(
    (lessonId: string, seconds: number, total?: number) => {
      // Call external handler if provided
      if (onVideoProgress) {
        onVideoProgress(lessonId, seconds);
      }

      // Update local state
      setProgress((prev) => {
        if (!prev) return prev;

        const existingIndex = prev.lessonProgress.findIndex((p) => p.lessonId === lessonId);

        const updatedProgress: LMSLessonProgress = {
          lessonId,
          completed: existingIndex >= 0 ? prev.lessonProgress[existingIndex].completed : false,
          watchedSeconds: seconds,
          totalSeconds: total,
          lastPosition: seconds,
        };

        let updatedLessonProgress: LMSLessonProgress[];
        if (existingIndex >= 0) {
          updatedLessonProgress = [...prev.lessonProgress];
          updatedLessonProgress[existingIndex] = {
            ...updatedLessonProgress[existingIndex],
            ...updatedProgress,
          };
        } else {
          updatedLessonProgress = [...prev.lessonProgress, updatedProgress];
        }

        return {
          ...prev,
          lessonProgress: updatedLessonProgress,
          lastAccessedAt: new Date().toISOString(),
        };
      });
    },
    [onVideoProgress]
  );

  const getProgressPercent = useCallback(() => {
    return progress?.progressPercent ?? 0;
  }, [progress]);

  const getCompletedCount = useCallback(() => {
    return progress?.completedLessons ?? 0;
  }, [progress]);

  const getTotalCount = useCallback(() => {
    return progress?.totalLessons ?? totalLessons;
  }, [progress, totalLessons]);

  const value: LMSProgressContextValue = {
    progress,
    isLoading,
    error,
    isLessonCompleted,
    getLessonProgress,
    markLessonComplete,
    updateVideoProgress,
    getProgressPercent,
    getCompletedCount,
    getTotalCount,
  };

  return <LMSProgressContext.Provider value={value}>{children}</LMSProgressContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useLMSProgress() {
  const context = useContext(LMSProgressContext);
  if (!context) {
    throw new Error("useLMSProgress must be used within an LMSProgressProvider");
  }
  return context;
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  CourseCategory,
  CourseDisplayData,
  CourseEditCallbacks,
  CourseInstructor,
} from "../types";

/**
 * Context for course data - provides course data to all template components
 */
interface CourseDataContextValue {
  courseData: CourseDisplayData;
  instructors: CourseInstructor[];
  categories: CourseCategory[];
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail: string | null;
  /**
   * Play a free sample attached to a syllabus row. Supplied by the host app,
   * because the players live in @open-mtlms/lms-templates and this package must not
   * depend on them. Absent in the editor, where previews are not playable.
   */
  onPreviewPlay?: (preview: CoursePreviewPlayRequest) => void;
}

/** What the host app needs to mint playback for a syllabus sample. */
export interface CoursePreviewPlayRequest {
  videoKey: string;
  title: string;
}

const CourseDataContext = createContext<CourseDataContextValue | null>(null);

/**
 * Context for edit mode - provides edit state and callbacks
 */
interface CourseEditContextValue {
  isEditMode: boolean;
  callbacks: CourseEditCallbacks;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
  /** When true, mode is fixed and cannot be changed (no dropdown shown) */
  modeReadOnly: boolean;
}

const CourseEditContext = createContext<CourseEditContextValue | null>(null);

/**
 * Provider for course data
 */
interface CourseDataProviderProps {
  children: ReactNode;
  courseData: CourseDisplayData;
  instructors?: CourseInstructor[];
  categories?: CourseCategory[];
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged?: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail?: string | null;
  /** See CourseDataContextValue.onPreviewPlay. */
  onPreviewPlay?: (preview: CoursePreviewPlayRequest) => void;
}

export function CourseDataProvider({
  children,
  courseData,
  instructors = [],
  categories = [],
  accessManaged = false,
  supportEmail = null,
  onPreviewPlay,
}: CourseDataProviderProps) {
  return (
    <CourseDataContext.Provider
      value={{
        courseData,
        instructors,
        categories,
        accessManaged,
        supportEmail,
        onPreviewPlay,
      }}
    >
      {children}
    </CourseDataContext.Provider>
  );
}

/**
 * Provider for edit mode
 */
interface CourseEditProviderProps {
  children: ReactNode;
  isEditMode: boolean;
  callbacks?: CourseEditCallbacks;
  activeModal?: string | null;
  setActiveModal?: (modal: string | null) => void;
  /** When true, mode is fixed and cannot be changed (no dropdown shown) */
  modeReadOnly?: boolean;
}

export function CourseEditProvider({
  children,
  isEditMode,
  callbacks = {},
  activeModal = null,
  setActiveModal = () => {},
  modeReadOnly = false,
}: CourseEditProviderProps) {
  return (
    <CourseEditContext.Provider
      value={{ isEditMode, callbacks, activeModal, setActiveModal, modeReadOnly }}
    >
      {children}
    </CourseEditContext.Provider>
  );
}

/**
 * Combined provider for both data and edit mode
 */
interface CourseProviderProps {
  children: ReactNode;
  courseData: CourseDisplayData;
  instructors?: CourseInstructor[];
  categories?: CourseCategory[];
  isEditMode?: boolean;
  callbacks?: CourseEditCallbacks;
  activeModal?: string | null;
  setActiveModal?: (modal: string | null) => void;
  /** When true, mode is fixed and cannot be changed (no dropdown shown) */
  modeReadOnly?: boolean;
  /** Tenant-wide access-managed storefront: hide all pricing and self-serve purchase CTAs. */
  accessManaged?: boolean;
  /** Tenant support email for the access-managed "Contact Support" CTA. */
  supportEmail?: string | null;
  /** See CourseDataContextValue.onPreviewPlay. */
  onPreviewPlay?: (preview: CoursePreviewPlayRequest) => void;
}

export function CourseProvider({
  children,
  courseData,
  instructors = [],
  categories = [],
  isEditMode = false,
  callbacks = {},
  activeModal = null,
  setActiveModal = () => {},
  modeReadOnly = false,
  accessManaged = false,
  supportEmail = null,
  onPreviewPlay,
}: CourseProviderProps) {
  return (
    <CourseDataProvider
      courseData={courseData}
      instructors={instructors}
      categories={categories}
      accessManaged={accessManaged}
      supportEmail={supportEmail}
      onPreviewPlay={onPreviewPlay}
    >
      <CourseEditProvider
        isEditMode={isEditMode}
        callbacks={callbacks}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        modeReadOnly={modeReadOnly}
      >
        {children}
      </CourseEditProvider>
    </CourseDataProvider>
  );
}

/**
 * Hook to access course data
 */
export function useCourseData(): CourseDataContextValue {
  const context = useContext(CourseDataContext);
  if (!context) {
    throw new Error("useCourseData must be used within a CourseDataProvider");
  }
  return context;
}

/**
 * Hook to access edit mode state and callbacks
 */
export function useCourseEdit(): CourseEditContextValue {
  const context = useContext(CourseEditContext);
  if (!context) {
    // Return a default read-only context if not in edit mode
    return {
      isEditMode: false,
      callbacks: {},
      activeModal: null,
      setActiveModal: () => {},
      modeReadOnly: false,
    };
  }
  return context;
}

/**
 * Hook to check if edit mode is enabled
 */
export function useIsEditMode(): boolean {
  const context = useContext(CourseEditContext);
  return context?.isEditMode ?? false;
}

/**
 * Safe accessor for the access-managed storefront flags. Unlike useCourseData
 * this never throws, so standalone components (e.g. CoursePricing) can consult
 * it even when rendered outside a CourseDataProvider, defaulting to the
 * normal storefront behavior.
 */
export function useStorefrontAccess(): { accessManaged: boolean; supportEmail: string | null } {
  const context = useContext(CourseDataContext);
  return {
    accessManaged: context?.accessManaged ?? false,
    supportEmail: context?.supportEmail ?? null,
  };
}

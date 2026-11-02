"use client";

import { createContext, useContext, type ReactNode } from "react";

interface CourseEditModeContextValue {
  isEditMode: boolean;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

const CourseEditModeContext = createContext<CourseEditModeContextValue>({
  isEditMode: false,
  activeModal: null,
  setActiveModal: () => {},
});

interface CourseEditModeProviderProps {
  children: ReactNode;
  editMode: boolean;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;
}

export function CourseEditModeProvider({
  children,
  editMode,
  activeModal,
  setActiveModal,
}: CourseEditModeProviderProps) {
  return (
    <CourseEditModeContext.Provider
      value={{
        isEditMode: editMode,
        activeModal,
        setActiveModal,
      }}
    >
      {children}
    </CourseEditModeContext.Provider>
  );
}

export function useCourseEditMode() {
  return useContext(CourseEditModeContext);
}

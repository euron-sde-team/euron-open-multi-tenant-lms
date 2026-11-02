"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface CourseEditorHeaderContextValue {
  headerContent: ReactNode;
  setHeaderContent: (content: ReactNode) => void;
}

const CourseEditorHeaderContext = createContext<CourseEditorHeaderContextValue | null>(null);

export function CourseEditorHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);

  const setContent = useCallback((content: ReactNode) => {
    setHeaderContent(content);
  }, []);

  return (
    <CourseEditorHeaderContext.Provider value={{ headerContent, setHeaderContent: setContent }}>
      {children}
    </CourseEditorHeaderContext.Provider>
  );
}

export function useCourseEditorHeader() {
  return useContext(CourseEditorHeaderContext);
}

"use client";

import { createContext, useContext, useMemo } from "react";

interface EditModeContextValue {
  isEditMode: boolean;
  isContentEditable: boolean; // If false, content editing is disabled (for course templates)
  restrictedSectionTypes: string[]; // Section types that should be completely static (e.g., ["header", "footer"])
  disableDeleteDuplicate: boolean; // If true, hide delete and duplicate buttons in section toolbar
}

const EditModeContext = createContext<EditModeContextValue>({
  isEditMode: false,
  isContentEditable: true,
  restrictedSectionTypes: [],
  disableDeleteDuplicate: false,
});

export function EditModeProvider({
  children,
  editMode,
  contentEditable = true,
  restrictedSectionTypes = [],
  disableDeleteDuplicate = false,
}: {
  children: React.ReactNode;
  editMode: boolean;
  contentEditable?: boolean;
  restrictedSectionTypes?: string[];
  disableDeleteDuplicate?: boolean;
}) {
  const value = useMemo(() => ({
    isEditMode: editMode,
    isContentEditable: contentEditable,
    restrictedSectionTypes,
    disableDeleteDuplicate,
  }), [editMode, contentEditable, restrictedSectionTypes, disableDeleteDuplicate]);

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const { isEditMode } = useContext(EditModeContext);
  return isEditMode;
}

export function useContentEditable() {
  const { isContentEditable, isEditMode } = useContext(EditModeContext);
  // Content is only editable when both edit mode is on AND content editing is allowed
  return isEditMode && isContentEditable;
}

export function useEditModeContext() {
  return useContext(EditModeContext);
}

// Check if a specific section type is restricted (should be completely static)
export function useIsSectionRestricted(sectionType: string) {
  const { restrictedSectionTypes, isContentEditable } = useContext(EditModeContext);
  // Section is restricted if content is not editable AND the section type is in the restricted list
  return !isContentEditable && restrictedSectionTypes.includes(sectionType);
}

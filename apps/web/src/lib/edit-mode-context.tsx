"use client";

import { createContext, useContext } from "react";

const EditModeContext = createContext<boolean>(false);

export function EditModeProvider({
  children,
  editMode,
}: {
  children: React.ReactNode;
  editMode: boolean;
}) {
  return (
    <EditModeContext.Provider value={editMode}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}

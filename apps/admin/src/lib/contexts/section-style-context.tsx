"use client";

import type { TextStyle } from "@open-mtlms/shared";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";

import { useEditorStore } from "@/lib/stores/editor-store";

interface SectionStyleContextValue {
  getTextStyle: (key: string) => TextStyle | undefined;
  updateTextStyle: (key: string, style: TextStyle) => void;
  /**
   * Assigns a stable, section-scoped key to an editable text that has no
   * explicit styleKey, so its typography/size controls work. Keys are handed
   * out in mount order ("auto-0", "auto-1", ...), deterministic across
   * reloads for a static section (same positional caveat as explicit indexed
   * keys for reorderable lists).
   */
  getAutoKey: () => string;
}

const SectionStyleContext = createContext<SectionStyleContextValue | null>(null);

export function SectionStyleProvider({
  children,
  sectionId,
  textStyles,
}: {
  children: React.ReactNode;
  sectionId: string;
  textStyles?: Record<string, TextStyle>;
}) {
  const { updateSectionContent } = useEditorStore();

  // Monotonic per-section counter for auto-assigned keys (mount order).
  const autoKeyCounter = useRef(0);
  const getAutoKey = useCallback(() => `auto-${autoKeyCounter.current++}`, []);

  const getTextStyle = useCallback(
    (key: string): TextStyle | undefined => textStyles?.[key],
    [textStyles]
  );

  const updateTextStyle = useCallback(
    (key: string, style: TextStyle) => {
      const existing = textStyles ?? {};
      const next = { ...existing };
      if (Object.keys(style).length === 0) {
        delete next[key];
      } else {
        next[key] = style;
      }
      updateSectionContent(sectionId, { textStyles: next });
    },
    [textStyles, sectionId, updateSectionContent]
  );

  const value = useMemo(
    () => ({ getTextStyle, updateTextStyle, getAutoKey }),
    [getTextStyle, updateTextStyle, getAutoKey]
  );

  return (
    <SectionStyleContext.Provider value={value}>
      {children}
    </SectionStyleContext.Provider>
  );
}

export function useSectionStyleContext(): SectionStyleContextValue | null {
  return useContext(SectionStyleContext);
}

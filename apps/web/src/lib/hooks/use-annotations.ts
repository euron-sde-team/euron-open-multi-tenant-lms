"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * In-memory, per-question text annotation store (Bluebook / College Board
 * Digital SAT style). Students can highlight or underline passage text and
 * attach a note to any annotation.
 *
 * Offsets are CHARACTER offsets into the annotated container's `textContent`.
 * Because a question's passage text is static for the duration of an attempt,
 * these offsets are stable and can be re-applied as the student navigates back
 * and forth between questions.
 *
 * State lives only in memory (keyed by questionId), it survives navigation
 * within the current session but is intentionally NOT persisted to a backend
 * or localStorage.
 */

export type AnnotationKind = "highlight" | "underline";

export interface Annotation {
  id: string;
  questionId: string;
  start: number;
  end: number;
  kind: AnnotationKind;
  text: string;
  note?: string;
}

/** Payload accepted by `addAnnotation`, id and questionId are assigned for you. */
export type NewAnnotation = Pick<Annotation, "start" | "end" | "kind" | "text">;

export interface UseAnnotationsResult {
  /** All annotations for a question, ordered by start offset. */
  getForQuestion: (questionId: string) => Annotation[];
  /** Only the annotations that carry a note, for a question. */
  getNotesForQuestion: (questionId: string) => Annotation[];
  /** Create an annotation and return its generated id. */
  addAnnotation: (questionId: string, annotation: NewAnnotation) => string;
  /** Remove an annotation by id. */
  removeAnnotation: (id: string) => void;
  /** Attach/replace (or clear, with "") the note on an annotation. */
  setNote: (id: string, note: string) => void;
}

function makeId(): string {
  // Crypto-backed when available; cheap fallback otherwise. SSR-safe.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `anno_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useAnnotations(): UseAnnotationsResult {
  // Map<questionId, Annotation[]> held in state so consumers re-render on change.
  const [byQuestion, setByQuestion] = useState<Record<string, Annotation[]>>({});

  // Keep a ref in sync so `addAnnotation` can return a stable id synchronously
  // without depending on the latest render's closure.
  const byQuestionRef = useRef(byQuestion);
  byQuestionRef.current = byQuestion;

  const getForQuestion = useCallback(
    (questionId: string): Annotation[] => byQuestion[questionId] ?? [],
    [byQuestion],
  );

  const getNotesForQuestion = useCallback(
    (questionId: string): Annotation[] =>
      (byQuestion[questionId] ?? []).filter((a) => typeof a.note === "string" && a.note.length > 0),
    [byQuestion],
  );

  const addAnnotation = useCallback((questionId: string, annotation: NewAnnotation): string => {
    const id = makeId();
    const next: Annotation = { id, questionId, ...annotation };

    setByQuestion((prev) => {
      const existing = prev[questionId] ?? [];
      const merged = [...existing, next].sort((a, b) => a.start - b.start || a.end - b.end);
      return { ...prev, [questionId]: merged };
    });

    return id;
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setByQuestion((prev) => {
      let changed = false;
      const out: Record<string, Annotation[]> = {};
      for (const [questionId, list] of Object.entries(prev)) {
        const filtered = list.filter((a) => a.id !== id);
        if (filtered.length !== list.length) changed = true;
        out[questionId] = filtered;
      }
      return changed ? out : prev;
    });
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setByQuestion((prev) => {
      let changed = false;
      const out: Record<string, Annotation[]> = {};
      for (const [questionId, list] of Object.entries(prev)) {
        const mapped = list.map((a) => {
          if (a.id !== id) return a;
          changed = true;
          return { ...a, note: note.length > 0 ? note : undefined };
        });
        out[questionId] = mapped;
      }
      return changed ? out : prev;
    });
  }, []);

  return useMemo(
    () => ({
      getForQuestion,
      getNotesForQuestion,
      addAnnotation,
      removeAnnotation,
      setNote,
    }),
    [getForQuestion, getNotesForQuestion, addAnnotation, removeAnnotation, setNote],
  );
}

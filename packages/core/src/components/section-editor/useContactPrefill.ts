"use client";

import { useEffect, useRef } from "react";

import { useSectionEditor, type ContactPrefill } from "./SectionEditorContext";

/**
 * Seed a contact form with the logged-in member's details exactly once, as soon
 * as the prefill becomes available (the web app's auth store hydrates
 * asynchronously, so `contactPrefill` may start null and populate a tick later).
 *
 * No-op in edit mode and for logged-out visitors, leaving the form blank. The
 * `apply` callback is held in a ref so callers can pass an inline closure
 * without retriggering the effect.
 */
export function useContactPrefill(
  apply: (prefill: Required<ContactPrefill>) => void
): void {
  const { contactPrefill, isEditMode } = useSectionEditor();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const applied = useRef(false);

  useEffect(() => {
    if (isEditMode || applied.current || !contactPrefill) return;
    const { name = "", email = "", phone = "" } = contactPrefill;
    if (!name && !email && !phone) return;
    applyRef.current({ name, email, phone });
    applied.current = true;
  }, [contactPrefill, isEditMode]);
}

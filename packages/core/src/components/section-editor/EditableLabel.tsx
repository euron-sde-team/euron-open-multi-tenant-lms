"use client";

import type { TextStyle } from "@open-mtlms/shared";

import { useSectionEditor } from "./SectionEditorContext";

export interface EditableLabelProps {
  /** Current stored value. Undefined/empty falls back to `fallback`. */
  value?: string;
  /**
   * The copy this label shipped with. Used as the display value when the tenant
   * has never touched it, and as the placeholder while editing, so existing
   * pages render identically after a label is promoted to editable.
   */
  fallback: string;
  onChange: (value: string) => void;
  /** Optional per-label typography controls, same contract as EditableText. */
  styleKey?: string;
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  multiline?: boolean;
  className?: string;
}

/**
 * A fixed piece of section copy that tenants can rewrite.
 *
 * Templates historically hardcoded connective labels, "Featured in", "Learn",
 * "Monthly", "Best Value", while making the values beside them editable. That
 * reads as broken: a tenant renames the logos but is stuck with our wording,
 * and anything not in English or not matching their vertical has no way out.
 *
 * Wrapping the literal in this component makes it editable without changing
 * what an untouched page renders. Read-only mode emits the bare string, so
 * there is no extra DOM node and no layout shift versus the hardcoded version.
 */
export function EditableLabel({
  value,
  fallback,
  onChange,
  styleKey,
  style,
  onStyleChange,
  multiline,
  className,
}: EditableLabelProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const text = value ?? fallback;

  if (!isEditMode) return <>{text}</>;

  return (
    <EditableText
      value={text}
      onChange={onChange}
      placeholder={fallback}
      styleKey={styleKey}
      style={style}
      onStyleChange={onStyleChange}
      multiline={multiline}
      className={className}
    />
  );
}

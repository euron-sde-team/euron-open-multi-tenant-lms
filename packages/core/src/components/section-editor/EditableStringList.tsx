"use client";

import type { ReactNode } from "react";

import { useSectionEditor } from "./SectionEditorContext";

export interface EditableStringListProps {
  /** The stored array. Undefined is treated as empty. */
  items?: string[];
  onChange: (next: string[]) => void;
  /**
   * Wraps each item in its own chrome (chip styling, mono font, per-index
   * colour). Receives the already-resolved node, a plain string in read mode,
   * an inline text editor in edit mode, so callers keep their exact markup
   * without knowing which mode they are in.
   */
  renderItem: (node: ReactNode, index: number) => ReactNode;
  /** Seed value for a newly added entry. */
  newItemValue: string;
  /** Copy on the add button, e.g. "+ Add tag". */
  addLabel: string;
  /** Placeholder for empty items while editing. Defaults to `newItemValue`. */
  placeholder?: string;
  /** Wrapper class for the list container. */
  className?: string;
}

/**
 * A plain `string[]` of short labels (chips, tags, ticker lines) that tenants
 * can edit, reorder-by-deletion, and extend.
 *
 * Several templates rendered these arrays with no edit affordance at all, the
 * values shipped as decoration and there was no way to change them from the
 * page editor, only by asking us. Read mode emits exactly what the section
 * rendered before; edit mode adds inline inputs plus add/remove controls.
 */
export function EditableStringList({
  items,
  onChange,
  renderItem,
  newItemValue,
  addLabel,
  placeholder,
  className,
}: EditableStringListProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const list = items ?? [];

  if (!isEditMode) {
    return <>{list.map((item, i) => renderItem(item, i))}</>;
  }

  return (
    <>
      {list.map((item, i) => (
        <span key={i} className={className}>
          {renderItem(
            <span className="group/item inline-flex items-center gap-0.5">
              <EditableText
                value={item}
                onChange={(value) => {
                  const next = [...list];
                  next[i] = value;
                  onChange(next);
                }}
                placeholder={placeholder ?? newItemValue}
              />
              <button
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                className="opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
              >
                ×
              </button>
            </span>,
            i,
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, newItemValue])}
        className="rounded border border-dashed border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground/70 transition-colors hover:border-primary/50 hover:text-foreground"
      >
        {addLabel}
      </button>
    </>
  );
}

"use client";

/**
 * Drag-and-drop primitives for the LMS curriculum editor.
 *
 * The editor page wraps sections and lessons with `SortableItemWrapper`, which
 * applies `useSortable` via render-prop so the existing JSX stays in place
 * (no large component extraction). Helpers here also keep the editor's
 * id-namespace logic in one spot so a section and a lesson can never collide
 * on the same dnd id.
 */

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@open-mtlms/core";
import { GripVertical } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

const SECTION_PREFIX = "section:";
const LESSON_PREFIX = "lesson:";
const SECTION_DROP_PREFIX = "section-drop:";

export function makeSectionDndId(id: string): string {
  return `${SECTION_PREFIX}${id}`;
}
export function makeLessonDndId(id: string): string {
  return `${LESSON_PREFIX}${id}`;
}
export function makeSectionDropDndId(id: string): string {
  return `${SECTION_DROP_PREFIX}${id}`;
}

export type DndIdInfo =
  | { kind: "section"; id: string }
  | { kind: "lesson"; id: string }
  | { kind: "section-drop"; sectionId: string }
  | { kind: "unknown"; id: string };

export function parseDndId(dndId: string | number): DndIdInfo {
  const raw = String(dndId);
  if (raw.startsWith(SECTION_PREFIX)) {
    return { kind: "section", id: raw.slice(SECTION_PREFIX.length) };
  }
  if (raw.startsWith(LESSON_PREFIX)) {
    return { kind: "lesson", id: raw.slice(LESSON_PREFIX.length) };
  }
  if (raw.startsWith(SECTION_DROP_PREFIX)) {
    return { kind: "section-drop", sectionId: raw.slice(SECTION_DROP_PREFIX.length) };
  }
  return { kind: "unknown", id: raw };
}

export interface SortableRenderArgs {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
  isOver: boolean;
}

interface SortableItemWrapperProps {
  id: string;
  disabled?: boolean;
  data?: Record<string, unknown>;
  children: (args: SortableRenderArgs) => ReactNode;
}

/**
 * Render-prop wrapper around useSortable. Keeps existing inline JSX in the
 * editor page; the wrapper only injects ref, style, attributes, listeners,
 * and a small isDragging / isOver state for visual hints.
 */
export function SortableItemWrapper({
  id,
  disabled,
  data,
  children,
}: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled, data });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The original row position becomes a dim "ghost" so the layout doesn't
    // collapse. The floating DragOverlay shows the active version.
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <>
      {children({
        setNodeRef,
        style,
        attributes,
        listeners,
        isDragging,
        isOver,
      })}
    </>
  );
}

/**
 * Drag handle button. Only the handle initiates a drag, so the rest of the
 * row stays clickable for expand / menu / inline edit. Disabled state shows
 * a not-allowed cursor and dims the icon.
 */
export function DragHandle({
  attributes,
  listeners,
  size = "md",
  label,
  disabled,
}: {
  attributes: SortableRenderArgs["attributes"];
  listeners: SortableRenderArgs["listeners"];
  size?: "sm" | "md";
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "shrink-0 touch-none rounded p-0.5 text-muted-foreground transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing"
      )}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical
        className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}
        aria-hidden
      />
    </button>
  );
}

/**
 * Empty-section drop target. Renders a dashed strip "Drop lessons here" that
 * becomes a valid drop target via `useDroppable`. Highlights softly while a
 * lesson is dragged over it. Without this, an empty section cannot receive
 * cross-section drops because there's no sibling item to drop onto.
 */
export function SectionDropZone({
  sectionId,
  hidden,
}: {
  sectionId: string;
  hidden?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: makeSectionDropDndId(sectionId),
    data: { type: "section-drop", sectionId },
  });
  if (hidden) return null;
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label="Drop lessons here"
      className={cn(
        "mt-1 rounded-md border border-dashed px-2 py-2.5 text-center text-[10px] transition-colors",
        isOver
          ? "border-primary/60 bg-primary/5 text-primary"
          : "border-muted-foreground/20 text-muted-foreground/70"
      )}
    >
      Drop lessons here
    </div>
  );
}

/**
 * Tuned drop-snap animation. A tiny overshoot on landing reads as "settled"
 * without feeling bouncy. Used by <DragOverlay dropAnimation={...} /> in the
 * editor page.
 */
export const curriculumDropAnimation = {
  duration: 240,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
};

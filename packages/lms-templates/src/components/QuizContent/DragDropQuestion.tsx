"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DragDropOptionItem {
  id: string;
  text: string;
}

interface DragDropQuestionProps {
  /** Question text; each blank ("__"+) becomes a drop slot */
  questionText: string;
  /** Options rendered as draggable chips */
  options: DragDropOptionItem[];
  /**
   * Current answer. Multi-blank callers pass one option id per blank (null =
   * empty). Single-blank callers may pass a plain string id.
   */
  value?: string | (string | null)[] | null;
  /** Emits the new answer: a string for a single blank, else an array. */
  onChange?: (next: string | (string | null)[] | null) => void;

  // --- Legacy single-blank API (still supported by the course-quiz player) ---
  /** @deprecated use `value` */
  selectedOptionId?: string | null;
  /** @deprecated use `onChange` */
  onSelect?: (optionId: string) => void;
  /** @deprecated use `onChange` */
  onClear?: () => void;

  /** Read-only review mode, disables placing/clearing. */
  disabled?: boolean;
  /** Class applied to the question text wrapper */
  questionClassName?: string;
  /** Additional class name */
  className?: string;
}

const BLANK_REGEX = /_{2,}/g;
const DATA_TRANSFER_KEY = "text/plain";

/**
 * Render markdown links `[text](url)` inside a plain-text stem segment as
 * clickable anchors (external http/https links open in a new tab). The stem is
 * plain text so we can locate the "___" blanks, but authors can still embed a
 * resource link (e.g. a Google Drive dataset) that should be clickable rather
 * than shown as raw `[text](url)`.
 */
const MD_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
function renderInlineLinks(value: string): React.ReactNode {
  if (!value || !value.includes("](")) return value;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  MD_LINK_RE.lastIndex = 0;
  while ((m = MD_LINK_RE.exec(value)) !== null) {
    if (m.index > last) nodes.push(value.slice(last, m.index));
    const [, text, href] = m;
    const external = /^https?:\/\//i.test(href);
    nodes.push(
      <a
        key={`lnk-${key++}`}
        href={href}
        className="text-primary font-medium underline decoration-2 underline-offset-2 hover:opacity-80"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {text}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < value.length) nodes.push(value.slice(last));
  return nodes;
}

/**
 * Fill-in-the-blank (DRAG_DROP) question renderer.
 *
 * Every "___" in the question text is replaced with a drop slot (dashed box).
 * the question may have one blank ("The capital of France is ___") or several
 * ("The capital of ___ is ___"). Options render as chips below that can be
 * dragged into any slot (native HTML5 drag and drop) or tapped to fill the next
 * empty slot, so it works on touch devices too. Each option lives in at most
 * one blank; dropping it elsewhere moves it. A placed chip shows inside its
 * slot with an x to clear it.
 *
 * Backward compatible: with the legacy single-blank API
 * (`selectedOptionId`/`onSelect`/`onClear`) it behaves exactly as before and
 * emits a string. With the array API (`value`/`onChange`) it supports any
 * number of blanks and emits an array (or a string when there is one blank).
 */
export function DragDropQuestion({
  questionText,
  options,
  value,
  onChange,
  selectedOptionId,
  onSelect,
  onClear,
  disabled = false,
  questionClassName,
  className,
}: DragDropQuestionProps) {
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // N blanks → N+1 text segments interleaved with N slots.
  const segments = questionText.split(BLANK_REGEX);
  const blankCount = Math.max(0, segments.length - 1);
  const slotCount = blankCount > 0 ? blankCount : 1;

  // Normalize the current answer to an array of length slotCount.
  const answers: (string | null)[] = Array(slotCount).fill(null);
  if (Array.isArray(value)) {
    for (let i = 0; i < slotCount; i++) answers[i] = value[i] ?? null;
  } else if (typeof value === "string") {
    answers[0] = value || null;
  } else if (selectedOptionId != null) {
    answers[0] = selectedOptionId || null;
  }

  const placed = new Set(answers.filter(Boolean) as string[]);

  // Emit the new answer in the shape the caller expects.
  const emit = (next: (string | null)[]) => {
    if (onChange) {
      onChange(slotCount <= 1 ? next[0] ?? null : next);
      return;
    }
    const v = next[0];
    if (v) onSelect?.(v);
    else onClear?.();
  };

  const setBlank = (index: number, optionId: string | null) => {
    if (disabled) return;
    const next = [...answers];
    // An option lives in at most one blank, clear it elsewhere first (move).
    if (optionId) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] === optionId) next[i] = null;
      }
    }
    next[index] = optionId;
    emit(next);
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIdx(null);
    const optionId = e.dataTransfer.getData(DATA_TRANSFER_KEY);
    if (optionId && options.some((o) => o.id === optionId)) {
      setBlank(index, optionId);
    }
  };

  const renderSlot = (index: number) => {
    const sel = options.find((o) => o.id === answers[index]) ?? null;
    return (
      <span
        key={`slot-${index}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverIdx(index);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOverIdx(index);
        }}
        onDragLeave={() =>
          setDragOverIdx((cur) => (cur === index ? null : cur))
        }
        onDrop={handleDrop(index)}
        className={cn(
          "mx-1.5 inline-flex min-h-[2rem] min-w-[8rem] items-center justify-center rounded-lg border-2 border-dashed px-2 py-0.5 align-middle transition-colors",
          dragOverIdx === index
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/40",
          sel && "border-solid border-primary bg-primary/5"
        )}
      >
        {sel ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{sel.text}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBlank(index, null);
                }}
                aria-label="Clear answer"
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ) : (
          <span className="px-1 text-xs text-muted-foreground">
            {blankCount > 1
              ? `Blank ${index + 1}`
              : dragOverIdx === index
                ? "Release to place"
                : "Drop answer here"}
          </span>
        )}
      </span>
    );
  };

  // Tap-to-place fills the first empty blank (touch friendly).
  const placeIntoFirstEmpty = (optionId: string) => {
    const emptyIdx = answers.findIndex((a) => !a);
    setBlank(emptyIdx === -1 ? 0 : emptyIdx, optionId);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Question text with each blank replaced by a drop slot */}
      <div className={cn("leading-loose", questionClassName)}>
        {blankCount > 0 ? (
          segments.map((seg, i) => (
            <React.Fragment key={i}>
              {renderInlineLinks(seg)}
              {i < blankCount && renderSlot(i)}
            </React.Fragment>
          ))
        ) : (
          <>
            {renderInlineLinks(questionText)} {renderSlot(0)}
          </>
        )}
      </div>

      {/* Draggable option chips */}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isPlaced = placed.has(opt.id);
          // Toggle: place into the next empty blank, or remove if already placed.
          const activate = () => {
            if (disabled) return;
            if (isPlaced) {
              const idx = answers.indexOf(opt.id);
              if (idx !== -1) setBlank(idx, null);
            } else {
              placeIntoFirstEmpty(opt.id);
            }
          };
          // Use a div with role="button" rather than a real <button>: native
          // HTML5 drag does not start reliably on <button>/<input> elements
          // across browsers (it silently fails in several), which made the chips
          // undraggable. A div drags reliably; keyboard activation keeps a11y.
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled || undefined}
              draggable={!isPlaced && !disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData(DATA_TRANSFER_KEY, opt.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingId(opt.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activate();
                }
              }}
              title={
                isPlaced
                  ? "Click to remove from the blank"
                  : "Drag into a blank or click to place"
              }
              className={cn(
                "select-none rounded-lg border px-3 py-1.5 text-sm transition-all",
                isPlaced
                  ? "border-primary/40 bg-primary/10 text-muted-foreground opacity-50"
                  : "cursor-grab border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 active:cursor-grabbing",
                draggingId === opt.id && "opacity-40",
                disabled && "cursor-default"
              )}
            >
              {opt.text}
            </div>
          );
        })}
      </div>

      {!disabled && (
        <p className="text-xs text-muted-foreground">
          {blankCount > 1
            ? "Drag each option into a blank, or tap an option to fill the next blank."
            : "Drag an option into the blank, or tap an option to place it."}
        </p>
      )}
    </div>
  );
}

export default DragDropQuestion;

"use client";

import { Highlighter, StickyNote, Trash2, Underline as UnderlineIcon, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Annotation, AnnotationKind, NewAnnotation } from "@/lib/hooks/use-annotations";
import { cn } from "@/lib/utils";

/**
 * Bluebook-style highlightable passage. Wraps arbitrary rendered passage
 * content (markdown output, plain text, React nodes) and lets the student:
 *   - select text → highlight / underline / add a note via a floating toolbar
 *   - click an existing annotation → remove it or edit its note
 *
 * Existing annotations are painted with the CSS Custom Highlight API
 * (`CSS.highlights`), which decorates ranges WITHOUT mutating the DOM, so the
 * passage's `textContent` (and therefore the character offsets) stay stable.
 * When the API is unavailable the component degrades gracefully: selection +
 * the toolbar still work, only the persistent paint is skipped.
 *
 * Offsets are character offsets into `containerRef.current.textContent`, mapped
 * to/from DOM Ranges with a TreeWalker over text nodes.
 */

const HL_NAME = "lms-hl";
const UL_NAME = "lms-ul";

// ::highlight() rules can't be expressed as Tailwind classes, inject once.
const HIGHLIGHT_CSS = `
::highlight(${HL_NAME}) { background: #fde68a; color: inherit; }
::highlight(${UL_NAME}) { text-decoration: underline; text-decoration-color: #f59e0b; text-decoration-thickness: 2px; }
`;

interface ToolbarState {
  x: number;
  y: number;
  // When editing an existing annotation we carry its id; otherwise a pending
  // selection range described by char offsets + text.
  mode: "create" | "edit";
  start: number;
  end: number;
  text: string;
  annotationId?: string;
}

interface HighlightablePassageProps {
  questionId: string;
  annotations: Annotation[];
  onAdd: (questionId: string, annotation: NewAnnotation) => string;
  onRemove: (id: string) => void;
  onSetNote: (id: string, note: string) => void;
  children: React.ReactNode;
  className?: string;
}

/** Feature-detect the CSS Custom Highlight API (SSR-safe). */
function supportsHighlightApi(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof CSS !== "undefined" &&
    // `CSS.highlights` is a registry (Map-like); `Highlight` is the ctor.
    "highlights" in CSS &&
    typeof (window as unknown as { Highlight?: unknown }).Highlight === "function"
  );
}

/**
 * Compute the [start, end) character offsets of `range` within `root`, by
 * walking text nodes in document order. Returns null if the range endpoints
 * are not both inside `root`.
 */
function rangeToOffsets(root: Node, range: Range): { start: number; end: number } | null {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let start = -1;
  let end = -1;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (node === range.startContainer) start = offset + range.startOffset;
    if (node === range.endContainer) end = offset + range.endOffset;
    offset += len;
    node = walker.nextNode();
  }
  if (start < 0 || end < 0 || start === end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Rebuild a DOM Range spanning [start, end) characters within `root` by
 * walking text nodes. Returns null if the offsets fall outside the content.
 */
function offsetsToRange(root: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (startNode === null && start <= offset + len) {
      startNode = node;
      startNodeOffset = start - offset;
    }
    if (endNode === null && end <= offset + len) {
      endNode = node;
      endNodeOffset = end - offset;
    }
    if (startNode && endNode) break;
    offset += len;
    node = walker.nextNode();
  }
  if (!startNode || !endNode) return null;
  try {
    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return range;
  } catch {
    return null;
  }
}

export function HighlightablePassage({
  questionId,
  annotations,
  onAdd,
  onRemove,
  onSetNote,
  children,
  className,
}: HighlightablePassageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  // (Re)paint existing annotations via the CSS Custom Highlight API.
  const applyHighlights = useCallback(() => {
    const root = containerRef.current;
    if (!root || !supportsHighlightApi()) return;

    const HighlightCtor = (window as unknown as { Highlight: typeof Highlight }).Highlight;
    const hlRanges: Range[] = [];
    const ulRanges: Range[] = [];

    for (const a of annotations) {
      const range = offsetsToRange(root, a.start, a.end);
      if (!range) continue;
      (a.kind === "underline" ? ulRanges : hlRanges).push(range);
    }

    if (hlRanges.length > 0) {
      CSS.highlights.set(HL_NAME, new HighlightCtor(...hlRanges));
    } else {
      CSS.highlights.delete(HL_NAME);
    }
    if (ulRanges.length > 0) {
      CSS.highlights.set(UL_NAME, new HighlightCtor(...ulRanges));
    } else {
      CSS.highlights.delete(UL_NAME);
    }
  }, [annotations]);

  // Re-apply on mount and whenever annotations change (after layout/paint of children).
  useLayoutEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  // Clear our highlight registrations on unmount so they don't leak to other
  // questions sharing the same registry names.
  useEffect(() => {
    return () => {
      if (!supportsHighlightApi()) return;
      CSS.highlights.delete(HL_NAME);
      CSS.highlights.delete(UL_NAME);
    };
  }, []);

  const closeToolbar = useCallback(() => {
    setToolbar(null);
    setNoteOpen(false);
    setNoteDraft("");
  }, []);

  // Position helper: translate a client rect to coords relative to the container.
  const localPoint = useCallback((rect: DOMRect) => {
    const root = containerRef.current;
    const base = root?.getBoundingClientRect();
    return {
      x: rect.left - (base?.left ?? 0) + rect.width / 2,
      y: rect.top - (base?.top ?? 0),
    };
  }, []);

  // Find an existing annotation whose range contains the click point.
  const annotationAtPoint = useCallback(
    (clientX: number, clientY: number): Annotation | null => {
      const root = containerRef.current;
      if (!root) return null;
      for (const a of annotations) {
        const range = offsetsToRange(root, a.start, a.end);
        if (!range) continue;
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
            return a;
          }
        }
      }
      return null;
    },
    [annotations],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const root = containerRef.current;
      if (!root) return;

      const selection = window.getSelection();
      const selectedText = selection ? selection.toString() : "";

      // No (real) selection → treat as a click; maybe an existing annotation.
      if (!selection || selection.isCollapsed || selectedText.trim().length === 0) {
        const hit = annotationAtPoint(e.clientX, e.clientY);
        if (hit) {
          const range = offsetsToRange(root, hit.start, hit.end);
          const rect = range?.getClientRects()[0];
          const pt = rect ? localPoint(rect) : { x: 0, y: 0 };
          setToolbar({
            mode: "edit",
            x: pt.x,
            y: pt.y,
            start: hit.start,
            end: hit.end,
            text: hit.text,
            annotationId: hit.id,
          });
          setNoteDraft(hit.note ?? "");
          setNoteOpen(false);
        } else {
          closeToolbar();
        }
        return;
      }

      const range = selection.getRangeAt(0);
      const offsets = rangeToOffsets(root, range);
      if (!offsets) {
        closeToolbar();
        return;
      }

      const rect = range.getBoundingClientRect();
      const pt = localPoint(rect);
      setToolbar({
        mode: "create",
        x: pt.x,
        y: pt.y,
        start: offsets.start,
        end: offsets.end,
        text: selectedText,
      });
      setNoteDraft("");
      setNoteOpen(false);
    },
    [annotationAtPoint, closeToolbar, localPoint],
  );

  const commitCreate = useCallback(
    (kind: AnnotationKind): string | null => {
      if (!toolbar || toolbar.mode !== "create") return null;
      const id = onAdd(questionId, {
        start: toolbar.start,
        end: toolbar.end,
        kind,
        text: toolbar.text,
      });
      window.getSelection()?.removeAllRanges();
      return id;
    },
    [onAdd, questionId, toolbar],
  );

  const handleHighlight = useCallback(() => {
    commitCreate("highlight");
    closeToolbar();
  }, [commitCreate, closeToolbar]);

  const handleUnderline = useCallback(() => {
    commitCreate("underline");
    closeToolbar();
  }, [commitCreate, closeToolbar]);

  // "Note" on a fresh selection: create a highlight first (so there's something
  // to anchor the note to), then open the note editor for it.
  const handleNote = useCallback(() => {
    if (!toolbar) return;
    if (toolbar.mode === "create") {
      const id = commitCreate("highlight");
      if (!id) {
        closeToolbar();
        return;
      }
      setToolbar((prev) => (prev ? { ...prev, mode: "edit", annotationId: id } : prev));
      setNoteDraft("");
      setNoteOpen(true);
    } else {
      setNoteOpen(true);
    }
  }, [toolbar, commitCreate, closeToolbar]);

  const saveNote = useCallback(() => {
    if (toolbar?.annotationId) {
      const text = noteDraft.trim();
      if (typeof window !== "undefined" && !text && typeof window.prompt === "function") {
        // No inline content, nothing to save; just close.
      }
      onSetNote(toolbar.annotationId, text);
    }
    closeToolbar();
  }, [toolbar, noteDraft, onSetNote, closeToolbar]);

  const handleRemove = useCallback(() => {
    if (toolbar?.annotationId) onRemove(toolbar.annotationId);
    closeToolbar();
  }, [toolbar, onRemove, closeToolbar]);

  return (
    <div className={cn("relative", className)}>
      {/* ::highlight() rules, not expressible via Tailwind. */}
      <style dangerouslySetInnerHTML={{ __html: HIGHLIGHT_CSS }} />

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="select-text leading-relaxed text-foreground [&_*]:cursor-text"
      >
        {children}
      </div>

      {toolbar && (
        <div
          role="toolbar"
          aria-label="Annotation tools"
          className={cn(
            "absolute z-50 -translate-x-1/2 -translate-y-full",
            "rounded-lg border border-border bg-card p-1 shadow-lg",
            "flex items-center gap-1",
          )}
          style={{ left: toolbar.x, top: Math.max(toolbar.y - 8, 0) }}
          // Keep the browser selection while interacting with the toolbar.
          onMouseDown={(e) => e.preventDefault()}
        >
          {!noteOpen ? (
            <>
              {toolbar.mode === "create" ? (
                <>
                  <ToolbarButton label="Highlight" onClick={handleHighlight}>
                    <Highlighter className="h-4 w-4 text-amber-500" />
                  </ToolbarButton>
                  <ToolbarButton label="Underline" onClick={handleUnderline}>
                    <UnderlineIcon className="h-4 w-4 text-amber-600" />
                  </ToolbarButton>
                  <ToolbarButton label="Note" onClick={handleNote}>
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </ToolbarButton>
                  <ToolbarButton label="Cancel" onClick={closeToolbar}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </ToolbarButton>
                </>
              ) : (
                <>
                  <ToolbarButton label="Edit note" onClick={handleNote}>
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </ToolbarButton>
                  <ToolbarButton label="Remove" onClick={handleRemove}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </ToolbarButton>
                  <ToolbarButton label="Close" onClick={closeToolbar}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </ToolbarButton>
                </>
              )}
            </>
          ) : (
            <div className="flex w-56 flex-col gap-2 p-1">
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note…"
                className={cn(
                  "h-20 w-full resize-none rounded-md border border-border bg-background",
                  "px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                )}
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={closeToolbar}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNote}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

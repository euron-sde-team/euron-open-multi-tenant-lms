"use client";

/**
 * Drag-and-drop ordering for the admin catalog grids.
 *
 * One component for courses, books, bundles, batches and test series, because
 * they are all the same shape: a flat grid of cards whose order the admin
 * controls and learners then see.
 *
 * Three things are deliberate:
 *
 * 1. A DEDICATED DRAG HANDLE, not a draggable card. Every card here holds
 *    three to six interactive controls (Publish, Edit, Delete, copy-link).
 *    Spreading drag listeners on the card root swallows those clicks.
 *
 * 2. rectSortingStrategy, not verticalListSortingStrategy. These are grids,
 *    so neighbours sit both across and below; the vertical strategy animates
 *    as if everything were in one column.
 *
 * 3. DRAGGING IS DISABLED WHILE A LIST IS FILTERED. Reordering a visible
 *    subset cannot express a whole-list order, the rows you can't see still
 *    have positions. The server would reject it anyway (it requires the
 *    complete set), so the handles come off and the reason is shown.
 */

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@open-mtlms/core";
import { GripVertical } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

interface SortableCardProps {
  id: string;
  disabled: boolean;
  children: ReactNode;
  /** Accessible name for the handle, e.g. "Reorder Python Basics". */
  handleLabel: string;
}

function SortableCard({
  id,
  disabled,
  children,
  handleLabel,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-50 opacity-40")}
    >
      {!disabled && (
        <button
          type="button"
          aria-label={handleLabel}
          // touch-none stops mobile Safari scrolling the page instead of
          // starting a drag.
          //
          // select-none matters more than it looks: on cards with no thumbnail
          // (test series, and any card whose text starts at the top) the handle
          // sits directly over the title, and press-and-move begins a native
          // TEXT SELECTION that swallows the pointer sequence, the drag never
          // starts. Cards with an image above the text hid this, which is why
          // it only showed up on some pages.
          className="absolute left-2 top-2 z-20 cursor-grab touch-none select-none rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-opacity hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          // The handle is for dragging only, let clicks fall through to
          // nothing rather than triggering the card's navigation.
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}

export interface SortableCardGridProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** Tailwind grid classes, each page keeps its own column counts. */
  className?: string;
  /**
   * Off when the tenant hasn't enabled ordered products, or while the list is
   * filtered. The grid still renders; only the handles and drag behaviour go.
   */
  enabled: boolean;
  /**
   * Commit a new order. Receives the COMPLETE list of ids, top-left to
   * bottom-right. Throwing (or rejecting) restores the previous order.
   */
  onReorder: (orderedIds: string[]) => Promise<void>;
}

export function SortableCardGrid<T>({
  items,
  getId,
  getLabel,
  renderCard,
  className,
  enabled,
  onReorder,
}: SortableCardGridProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // What the grid shows mid-drag. null = show `items` as given.
  const [override, setOverride] = useState<T[] | null>(null);

  const shown = override ?? items;
  const ids = useMemo(() => shown.map(getId), [shown, getId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Without a threshold, a click that twitches by a pixel starts a drag
      // and the card's own buttons stop feeling clickable.
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      const oldIndex = shown.findIndex((i) => getId(i) === active.id);
      const newIndex = shown.findIndex((i) => getId(i) === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const before = shown;
      const next = arrayMove(shown, oldIndex, newIndex);
      // Show the move immediately, waiting for the round trip makes the card
      // snap back under the cursor before landing where it was dropped.
      setOverride(next);

      try {
        await onReorder(next.map(getId));
        // Let the refetched list take over again.
        setOverride(null);
      } catch {
        // The caller has already explained what went wrong; put the cards back
        // so the screen matches the server rather than a move that didn't save.
        setOverride(before);
      }
    },
    [shown, getId, onReorder]
  );

  const activeItem = activeId
    ? shown.find((i) => getId(i) === activeId)
    : undefined;

  if (!enabled) {
    return (
      <div className={className}>
        {items.map((item) => (
          <div key={getId(item)}>{renderCard(item)}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {shown.map((item) => (
            <SortableCard
              key={getId(item)}
              id={getId(item)}
              disabled={false}
              handleLabel={`Reorder ${getLabel(item)}`}
            >
              {renderCard(item)}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
      {/* The card follows the cursor; the original stays dimmed in place so
          the grid doesn't reflow out from under the drag. */}
      <DragOverlay>
        {activeItem ? (
          <div className="rotate-1 opacity-90 shadow-2xl">
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

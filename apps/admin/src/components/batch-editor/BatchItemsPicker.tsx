"use client";

/**
 * Course/book picker modal for the batch Content tab.
 *
 * Mirrors the bundle item picker (apps/admin/.../bundles/[id]/page.tsx) so
 * tenants get a consistent UX for grouping primitives. Multi-select per type;
 * `BATCH` cannot mix types in a single add operation, matching the
 * `addBatchItem({ item_type, course_id | book_id })` API shape.
 */

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import { formatBatchCourseLabel } from "@open-mtlms/shared";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { batchesApi, type BatchDetail } from "@/lib/api/batches";
import { booksApi, type Book } from "@/lib/api/books";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import type { LMSCourse } from "@/lib/types/course-lms";

type ItemType = "COURSE" | "BOOK";

/**
 * Collapses the default shadcn focus ring (which has a 2px background offset)
 * against the input border, so focus reads as a single primary edge instead
 * of a double-border halo. Mirrors the helper in `BatchScheduleManager`.
 */
const FOCUS_FIX =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-primary " +
  "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: BatchDetail;
  /** Called after at least one item is successfully added. */
  onAdded: () => void;
}

export function BatchItemsPicker({ open, onOpenChange, batch, onAdded }: Props) {
  const { toast } = useToast();
  const [itemType, setItemType] = useState<ItemType>("COURSE");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<LMSCourse[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);

  const loadAvailableItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const [coursesRes, booksRes] = await Promise.all([
        coursesLmsApi.getCourses({ page: 1, limit: 100 }),
        booksApi.getBooks(1, 100),
      ]);
      setAvailableCourses(coursesRes.courses);
      setAvailableBooks(booksRes.books);
    } catch (err) {
      console.error("[batch-items-picker] failed to load items:", err);
      toast({
        title: "Error",
        description: "Could not load courses or books.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      loadAvailableItems();
    } else {
      setSelectedIds([]);
    }
  }, [open, loadAvailableItems]);

  // Filter out items already in the batch
  const getAvailableCourses = () => {
    const inBatch = new Set(
      batch.items.filter((i) => i.itemType === "COURSE").map((i) => i.courseId)
    );
    return availableCourses.filter((c) => !inBatch.has(c.id));
  };
  const getAvailableBooks = () => {
    const inBatch = new Set(
      batch.items.filter((i) => i.itemType === "BOOK").map((i) => i.bookId)
    );
    return availableBooks.filter((b) => !inBatch.has(b.id));
  };

  const toggleSelection = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAll = () => {
    const items = itemType === "COURSE" ? getAvailableCourses() : getAvailableBooks();
    setSelectedIds(items.map((i) => i.id));
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setIsAdding(true);
    try {
      // Add sequentially so per-item validation errors surface clearly.
      for (const id of selectedIds) {
        await batchesApi.addBatchItem(batch.id, {
          item_type: itemType,
          course_id: itemType === "COURSE" ? id : null,
          book_id: itemType === "BOOK" ? id : null,
        });
      }
      onAdded();
      onOpenChange(false);
      setSelectedIds([]);
      toast({
        title: "Added",
        description: `${selectedIds.length} ${itemType === "COURSE" ? "course(s)" : "book(s)"} added to batch.`,
      });
    } catch (err) {
      console.error("[batch-items-picker] add failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to add items.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Content to Batch</DialogTitle>
          <DialogDescription>
            Pick courses or books to include. Learners get enrolled in every
            included course (and granted access to every included book) when they
            join the batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select
              value={itemType}
              onValueChange={(v) => {
                setItemType(v as ItemType);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger className={FOCUS_FIX}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COURSE">Course</SelectItem>
                <SelectItem value="BOOK">Book</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Select {itemType === "COURSE" ? "Courses" : "Books"}
              </Label>
              {!isLoadingItems && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="h-auto px-2 py-1 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    className="h-auto px-2 py-1 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                {itemType === "COURSE" ? (
                  getAvailableCourses().length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No courses available to add
                    </p>
                  ) : (
                    getAvailableCourses().map((course) => {
                      const selected = selectedIds.includes(course.id);
                      const url = resolveThumbnailForDisplay(
                        course.thumbnailKey ?? course.thumbnailUrl
                      );
                      return (
                        <div
                          key={course.id}
                          onClick={() => toggleSelection(course.id)}
                          className={`hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md p-2 ${
                            selected ? "bg-primary/10 ring-primary ring-1" : ""
                          }`}
                        >
                          <Checkbox selected={selected} />
                          <Thumbnail url={url} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {course.title}
                              </p>
                              <CourseModeBadge
                                mode={course.mode}
                                courseType={course.courseType}
                              />
                            </div>
                            <p className="text-muted-foreground truncate text-xs">
                              {course.slug}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : getAvailableBooks().length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    No books available to add
                  </p>
                ) : (
                  getAvailableBooks().map((book) => {
                    const selected = selectedIds.includes(book.id);
                    const url = resolveThumbnailForDisplay(book.thumbnailUrl);
                    return (
                      <div
                        key={book.id}
                        onClick={() => toggleSelection(book.id)}
                        className={`hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md p-2 ${
                          selected ? "bg-primary/10 ring-primary ring-1" : ""
                        }`}
                      >
                        <Checkbox selected={selected} />
                        <Thumbnail url={url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {book.title}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {book.slug}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {selectedIds.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {selectedIds.length}{" "}
                {itemType === "COURSE" ? "course(s)" : "book(s)"} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedIds([]);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isAdding || selectedIds.length === 0}>
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add{" "}
            {selectedIds.length > 0
              ? `${selectedIds.length} Item${selectedIds.length > 1 ? "s" : ""}`
              : "Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Checkbox({ selected }: { selected: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/30"
      }`}
    >
      {selected && <Check className="h-3 w-3" />}
    </div>
  );
}

/**
 * Course / book thumbnails are typically 16:9. The previous square 40×40
 * wrapper cropped them too aggressively for the operator to recognise the
 * image. A 40×64 (10×16 in Tailwind units) frame keeps the row height tight
 * but gives the thumbnail enough width to convey the content.
 */
function Thumbnail({ url }: { url: string | null | undefined }) {
  return (
    <div className="bg-muted h-10 w-16 flex-shrink-0 overflow-hidden rounded">
      {url && (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

/**
 * Inline category badge for the picker, labelled via `formatBatchCourseLabel`.
 */
function CourseModeBadge({
  mode,
  courseType,
}: {
  mode: string | null | undefined;
  courseType: string | null | undefined;
}) {
  const label = formatBatchCourseLabel(mode, courseType);
  if (!label) return null;
  const key = (mode ?? "").toUpperCase();
  const tones: Record<string, string> = {
    SELF_PACED:
      "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  };
  return (
    <Badge
      variant="outline"
      className={`flex-shrink-0 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide ${
        tones[key] ?? ""
      }`}
    >
      {label}
    </Badge>
  );
}

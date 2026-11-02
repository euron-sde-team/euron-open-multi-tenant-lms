"use client";

import { Button, cn, useToast } from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Loader2,
  Lock,
  Plus,
  Unlock,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  useCourseChain,
  useSaveChain,
} from "@/lib/hooks/use-course-sequence";
import { useLMSCourses } from "@/lib/hooks/use-courses-lms";

/**
 * SEQUENTIAL COURSES, the whole chain, built in one place.
 *
 * The model is a single linear sequence A → B → C, so this is one ordered list:
 * the admin adds courses, moves them up/down, and saves. Each course is then
 * gated behind the one above it; the first has no prerequisite.
 *
 * Reorder is up/down buttons rather than drag-and-drop, no extra dependency,
 * and a short chain (a handful of courses) reorders fine this way.
 *
 * Saving sends the whole ordered list to PUT /sequence, which rewrites the
 * links in one transaction and RELEASES any course dropped from the list. So
 * removing a row here genuinely un-gates that course.
 */
export function SequenceBuilder() {
  const { toast } = useToast();
  const { data: chain, isLoading: chainLoading } = useCourseChain();
  const { data: coursesData, isLoading: coursesLoading } = useLMSCourses({
    limit: 200,
  });
  const save = useSaveChain();

  // The working order, course ids, top to bottom. Seeded from the saved chain.
  const [order, setOrder] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (chain) setOrder(chain.map((s) => s.id));
  }, [chain]);

  const allCourses = useMemo(
    () => coursesData?.courses ?? [],
    [coursesData]
  );
  const byId = useMemo(
    () => new Map(allCourses.map((c) => [c.id, c])),
    [allCourses]
  );

  // A title even for a course that isn't on the current list page, fall back
  // to the chain's own copy so a row never renders blank.
  const titleFor = (id: string) =>
    decodeHtmlEntities(
      byId.get(id)?.title ?? chain?.find((s) => s.id === id)?.title ?? "Course"
    );

  const saved = useMemo(() => (chain ? chain.map((s) => s.id) : []), [chain]);
  const dirty = useMemo(
    () => order.length !== saved.length || order.some((id, i) => id !== saved[i]),
    [order, saved]
  );

  const addable = useMemo(() => {
    const inChain = new Set(order);
    const q = query.trim().toLowerCase();
    return allCourses
      .filter((c) => !inChain.has(c.id))
      // Published only. A draft isn't visible to learners, so gating a course
      // behind one would lock them out with no way to reach the prerequisite.
      // Publish the course first, then add it to the sequence.
      .filter((c) => String(c.status).toUpperCase() === "PUBLISHED")
      .filter(
        (c) => !q || decodeHtmlEntities(c.title).toLowerCase().includes(q)
      );
  }, [allCourses, order, query]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  const remove = (id: string) => setOrder((o) => o.filter((x) => x !== id));
  const add = (id: string) => {
    setOrder((o) => [...o, id]);
    setPicking(false);
    setQuery("");
  };

  const handleSave = () => {
    save.mutate(order, {
      onSuccess: () =>
        toast({
          title: "Course order saved",
          description: order.length
            ? "Learners will move through these courses in order."
            : "Sequence cleared, every course is open again.",
        }),
      onError: (err) =>
        toast({
          // The server names the loop verbatim if the order forms a cycle.
          title: "Couldn't save",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        }),
    });
  };

  if (chainLoading || coursesLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Course order</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Learners must finish each course before the next one opens. The first
          course is always unlocked.
        </p>
      </div>

      {order.length === 0 ? (
        <div className="text-muted-foreground rounded-lg bg-muted/50 px-4 py-8 text-center text-sm">
          No sequence yet. Add courses to set the order learners follow.
        </div>
      ) : (
        <ol className="space-y-2">
          {order.map((id, i) => (
            <li
              key={id}
              className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
            >
              <span className="text-muted-foreground w-5 text-center text-sm font-medium">
                {i + 1}
              </span>
              {i === 0 ? (
                <Unlock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              <span className="flex-1 truncate text-sm font-medium">
                {titleFor(id)}
              </span>
              {i > 0 && (
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  after {titleFor(order[i - 1])}
                </span>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === order.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Add-a-course */}
      {picking ? (
        <div className="rounded-lg border border-border p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="mb-2 h-9 w-full rounded-md bg-muted px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <p className="text-muted-foreground mb-2 px-1 text-xs">
            Only published courses can be sequenced.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {query
                  ? "No published courses match."
                  : "No more published courses to add."}
              </p>
            ) : (
              addable.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => add(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors",
                    "hover:bg-muted"
                  )}
                >
                  <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{decodeHtmlEntities(c.title)}</span>
                </button>
              ))
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicking(false);
                setQuery("");
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicking(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add a course
        </Button>
      )}

      {dirty && (
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOrder(saved)}
            disabled={save.isPending}
          >
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save order"}
          </Button>
        </div>
      )}
    </div>
  );
}

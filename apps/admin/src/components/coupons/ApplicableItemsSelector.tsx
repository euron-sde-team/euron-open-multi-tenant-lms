"use client";

import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@open-mtlms/core";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { booksApi } from "@/lib/api/books";
import type { CouponItemType } from "@/lib/api/coupons";
import { useBatches } from "@/lib/hooks/use-batches";
import { useBundles } from "@/lib/hooks/use-bundles";
import { useCourses } from "@/lib/hooks/use-courses";
import { useTestSeriesList } from "@/lib/hooks/use-test-series";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { cn } from "@/lib/utils";

export interface ApplicableItem {
  item_type: CouponItemType;
  course_id?: string | null;
  book_id?: string | null;
  bundle_id?: string | null;
  batch_id?: string | null;
  test_series_id?: string | null;
}

interface ApplicableItemsSelectorProps {
  value: ApplicableItem[];
  onChange: (items: ApplicableItem[]) => void;
}

/**
 * One tab per sellable entity. The `id` field is the `coupon_applicable_items`
 * FK column that entity maps to, that column, not `item_type`, is what the
 * backend matches on.
 */
const TABS = [
  { value: "courses", label: "Courses", type: "COURSE", idKey: "course_id" },
  { value: "books", label: "Books", type: "BOOK", idKey: "book_id" },
  { value: "bundles", label: "Bundles", type: "BUNDLE", idKey: "bundle_id" },
  { value: "batches", label: "Batches", type: "BATCH", idKey: "batch_id" },
  { value: "test-series", label: "Test Series", type: "TEST_SERIES", idKey: "test_series_id" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  type: CouponItemType;
  idKey: keyof ApplicableItem;
}>;

export function ApplicableItemsSelector({ value, onChange }: ApplicableItemsSelectorProps) {
  const idsFor = (type: CouponItemType, idKey: keyof ApplicableItem): string[] =>
    value
      .filter((i) => i.item_type === type)
      .map((i) => i[idKey] as string | null | undefined)
      .filter((id): id is string => !!id);

  // Each tab owns its slice: replacing a type's selection wipes and rebuilds
  // only that type's rows, leaving the other tabs untouched.
  const updateItems = (type: CouponItemType, ids: string[], idKey: string) => {
    const otherItems = value.filter((i) => i.item_type !== type);
    const newItems: ApplicableItem[] = ids.map((id) => ({
      item_type: type,
      [idKey]: id,
    }));
    onChange([...otherItems, ...newItems]);
  };

  const selectedByTab = Object.fromEntries(
    TABS.map((t) => [t.value, idsFor(t.type, t.idKey)]),
  ) as Record<(typeof TABS)[number]["value"], string[]>;

  const totalSelected = value.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Select applicable items</label>
        {totalSelected > 0 && (
          <span className="text-muted-foreground text-xs">
            {totalSelected} item{totalSelected === 1 ? "" : "s"} selected
          </span>
        )}
      </div>
      <Tabs defaultValue="courses" className="w-full">
        {/* Seven tabs no longer fit on one row, so they wrap instead of
            squeezing every label into an unreadable sliver. */}
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map((tab) => {
            const count = selectedByTab[tab.value].length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="courses">
          <CourseSelector
            selectedIds={selectedByTab.courses}
            onChange={(ids) => updateItems("COURSE", ids, "course_id")}
          />
        </TabsContent>
        <TabsContent value="books">
          <BookSelector
            selectedIds={selectedByTab.books}
            onChange={(ids) => updateItems("BOOK", ids, "book_id")}
          />
        </TabsContent>
        <TabsContent value="bundles">
          <BundleSelector
            selectedIds={selectedByTab.bundles}
            onChange={(ids) => updateItems("BUNDLE", ids, "bundle_id")}
          />
        </TabsContent>
        <TabsContent value="batches">
          <BatchSelector
            selectedIds={selectedByTab.batches}
            onChange={(ids) => updateItems("BATCH", ids, "batch_id")}
          />
        </TabsContent>
        <TabsContent value="test-series">
          <TestSeriesSelector
            selectedIds={selectedByTab["test-series"]}
            onChange={(ids) => updateItems("TEST_SERIES", ids, "test_series_id")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tab selector components
// ---------------------------------------------------------------------------

interface SelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function CourseSelector({ selectedIds, onChange }: SelectorProps) {
  const { selectedTenantId } = useTenantStore();
  const { data } = useCourses(selectedTenantId ?? undefined);
  const courses = data?.courses ?? [];

  return (
    <CheckboxList
      items={courses.map((c) => ({ id: c.id, name: c.title }))}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyMessage="No courses found"
    />
  );
}

function BookSelector({ selectedIds, onChange }: SelectorProps) {
  const [books, setBooks] = useState<Array<{ id: string; name: string }>>([]);

  // Books have no query hook, so this fetches directly, but from an effect.
  // The previous version fired the request during render, which React may run
  // twice or discard.
  useEffect(() => {
    let cancelled = false;
    booksApi
      .getBooks(1, 200)
      .then((res) => {
        if (!cancelled) setBooks(res.books.map((b) => ({ id: b.id, name: b.title })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CheckboxList
      items={books}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyMessage="No books found"
    />
  );
}

function BundleSelector({ selectedIds, onChange }: SelectorProps) {
  const { data } = useBundles();
  const bundles = data?.bundles ?? [];

  return (
    <CheckboxList
      items={bundles.map((b) => ({ id: b.id, name: b.title }))}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyMessage="No bundles found"
    />
  );
}

function BatchSelector({ selectedIds, onChange }: SelectorProps) {
  const { data } = useBatches(1, 200);
  const batches = data?.batches ?? [];

  return (
    <CheckboxList
      items={batches.map((b) => ({ id: b.id, name: b.title }))}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyMessage="No batches found"
    />
  );
}

function TestSeriesSelector({ selectedIds, onChange }: SelectorProps) {
  const { data } = useTestSeriesList({ limit: 200 });
  const series = data?.series ?? [];

  return (
    <CheckboxList
      items={series.map((s) => ({ id: s.id, name: s.title }))}
      selectedIds={selectedIds}
      onChange={onChange}
      emptyMessage="No test series found"
    />
  );
}

// ---------------------------------------------------------------------------
// Shared checkbox list (mirrors pattern from AudienceSelector)
// ---------------------------------------------------------------------------

function CheckboxList({
  items,
  selectedIds,
  onChange,
  emptyMessage,
}: {
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-2">
      {items.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className="block w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      <div className="max-h-[200px] overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          filtered.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted/30",
                )}
                onClick={() => toggle(item.id)}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
      )}
    </div>
  );
}

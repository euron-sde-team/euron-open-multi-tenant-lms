"use client";

import { Bookmark, BookOpen, GraduationCap, Loader2, Package, Trash2 } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { decodeHtmlEntities } from "@open-mtlms/shared";

import { apiGet, apiDelete } from "@/lib/api/api-client";
import { useContentTerms } from "@/lib/hooks/use-content-terms";

interface BookmarkItem {
  productId: string;
  productType: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  subtitle: string | null;
}

interface BookmarksData {
  courses: BookmarkItem[];
  books: BookmarkItem[];
  bundles: BookmarkItem[];
}

function useBookmarks() {
  return useQuery({
    queryKey: ["member-bookmarks"],
    queryFn: () => apiGet<BookmarksData>("/bookmarks"),
    staleTime: 2 * 60_000,
  });
}

function BookmarkCard({ item, type, onRemove }: { item: BookmarkItem; type: string; onRemove: () => void }) {
  const href = type === "COURSE" ? `/courses/${item.slug}` : type === "BOOK" ? `/books/${item.slug}` : `/bundles/${item.slug}`;
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-all hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
          {type === "COURSE" ? <GraduationCap className="h-5 w-5 text-zinc-400" /> : type === "BOOK" ? <BookOpen className="h-5 w-5 text-zinc-400" /> : <Package className="h-5 w-5 text-zinc-400" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-sm font-medium text-zinc-800 hover:text-primary dark:text-zinc-200">{decodeHtmlEntities(item.title)}</Link>
        {item.subtitle && <p className="truncate text-xs text-zinc-400">{decodeHtmlEntities(item.subtitle)}</p>}
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function BookmarksTab() {
  const terms = useContentTerms();
  const { data, isLoading } = useBookmarks();
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: ({ type, itemId }: { type: string; itemId: string }) =>
      apiDelete(`/bookmarks?type=${type}&item_id=${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-bookmarks"] }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;
  }

  const courses = data?.courses ?? [];
  const books = data?.books ?? [];
  const bundles = data?.bundles ?? [];
  const total = courses.length + books.length + bundles.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-16 dark:border-zinc-700">
        <Bookmark className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No bookmarks yet</p>
        <p className="mt-1 text-xs text-zinc-400">Save {terms.course.plural.toLowerCase()}, {terms.book.plural.toLowerCase()}, or {terms.bundle.plural.toLowerCase()} to access them quickly</p>
      </div>
    );
  }

  const sections = [
    { label: terms.course.plural, icon: GraduationCap, items: courses, type: "COURSE" },
    { label: terms.book.plural, icon: BookOpen, items: books, type: "BOOK" },
    { label: terms.bundle.plural, icon: Package, items: bundles, type: "BUNDLE" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Saved Items ({total})</h3>
      {sections.map((s) => (
        <div key={s.type}>
          <div className="mb-2 flex items-center gap-2">
            <s.icon className="h-4 w-4 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{s.label} ({s.items.length})</p>
          </div>
          <div className="space-y-2">
            {s.items.map((item) => (
              <BookmarkCard
                key={item.productId}
                item={item}
                type={s.type}
                onRemove={() => removeMutation.mutate({ type: s.type, itemId: item.productId })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

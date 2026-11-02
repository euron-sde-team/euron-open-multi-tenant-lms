"use client";

import { Button, Card, CardContent, Input } from "@open-mtlms/core";
import { formatBatchCourseLabel, formatBatchItemType } from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen, GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { fetchBatchContent } from "@/lib/api/batches";
import { useContentTerm } from "@/lib/hooks/use-content-terms";

interface Props {
  slug: string;
  hasAccess: boolean;
}

/**
 * Content tab, row-wise listing of every course and book bundled into the
 * batch. Visitors see the listing in preview mode (rows still render thumbs
 * + titles, but tapping a row routes them to the About-tab pricing block
 * instead of the LMS). Enrolled members get clickable rows that drop them
 * directly into the LMS course / book reader.
 */
export function BatchContentTab({ slug, hasAccess }: Props) {
  const batchTerm = useContentTerm("batch");
  const { data, isLoading, error } = useQuery({
    queryKey: ["batch-content", slug],
    queryFn: () => fetchBatchContent(slug),
    enabled: !!slug,
    retry: false,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((i) => {
      const title = (
        i.itemType === "COURSE" ? i.courseTitle : i.bookTitle
      )?.toLowerCase();
      return title?.includes(q);
    });
  }, [data, search]);

  if (error) {
    return (
      <Card className="my-6">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t load content. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!hasAccess && (
        <div className="bg-primary/5 text-foreground border-primary/20 mb-4 flex flex-col items-start justify-between gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center">
          <span className="text-muted-foreground">
            Preview only. Join the {batchTerm.singular.toLowerCase()} to start any course or book in the
            LMS.
          </span>
          <Button asChild size="sm">
            <Link href={`/batches/${slug}?tab=about`}>Join {batchTerm.singular}</Link>
          </Button>
        </div>
      )}

      <h1 className="mb-1 text-2xl font-bold">
        Content{" "}
        {data && (
          <span className="text-muted-foreground text-base font-normal">
            ({data.items.length})
          </span>
        )}
      </h1>

      <div className="my-6 flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search in batch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="bg-card flex items-stretch gap-4 rounded-xl border p-4"
            >
              <div className="bg-muted aspect-video h-auto w-40 flex-shrink-0 animate-pulse rounded-lg sm:w-48" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="bg-muted h-3 w-24 animate-pulse rounded" />
                <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search
                ? "No matching content."
                : `No content has been added to this ${batchTerm.singular.toLowerCase()} yet.`}
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {filtered.map((item) => {
          const isCourse = item.itemType === "COURSE";
          const title = isCourse ? item.courseTitle : item.bookTitle;
          // Visitors get routed to the pricing block instead of being thrown
          // at a 403 from the LMS. Enrolled members go straight in.
          const href = !hasAccess
            ? `/batches/${slug}?tab=about`
            : isCourse
              ? `/learn/${item.courseSlug}`
              : `/books/${item.bookSlug}`;
          const thumbnail = isCourse
            ? item.courseThumbnailKey
            : item.bookThumbnailUrl;
          const subtitle = isCourse ? item.courseSubtitle : null;
          const courseLabel = isCourse
            ? formatBatchCourseLabel(item.courseMode, item.courseType)
            : null;
          return (
            <Link
              key={item.id}
              href={href}
              className="bg-card hover:border-primary/30 hover:shadow-primary/5 group relative flex items-stretch gap-4 overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* Vertical type-tinted stripe on the left edge, courses get
                  the primary tint, books get a muted accent. */}
              <span
                className={`absolute inset-y-0 left-0 w-1 ${
                  isCourse ? "bg-primary/60" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <div className="bg-muted relative aspect-video h-auto w-40 flex-shrink-0 overflow-hidden rounded-lg sm:w-48">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                    {isCourse ? (
                      <GraduationCap className="h-6 w-6" />
                    ) : (
                      <BookOpen className="h-6 w-6" />
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    {isCourse ? (
                      <GraduationCap className="h-3 w-3" />
                    ) : (
                      <BookOpen className="h-3 w-3" />
                    )}
                    {formatBatchItemType(item.itemType)}
                  </span>
                  {courseLabel && (
                    <span className="bg-muted rounded-full px-2 py-0.5 normal-case tracking-normal">
                      {courseLabel}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-base font-semibold">
                  {title}
                </div>
                {subtitle && (
                  <div className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {subtitle}
                  </div>
                )}
                {!isCourse && item.bookAuthor && (
                  <div className="text-muted-foreground mt-1 text-sm">
                    by {item.bookAuthor}
                  </div>
                )}
              </div>
              <ArrowUpRight className="text-muted-foreground/0 group-hover:text-primary mt-1 h-4 w-4 flex-shrink-0 transition-colors group-hover:opacity-100" />
            </Link>
          );
        })}
      </ul>
    </>
  );
}

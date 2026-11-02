"use client";

import { useState } from "react";
import { Bookmark, BookOpen, GraduationCap, LogIn, Package, X } from "lucide-react";
import type { SectionConfig, BookmarkPageContent , ContentTerms } from "@open-mtlms/shared";
import { hasCustomSectionBackground, decodeHtmlEntities } from "@open-mtlms/shared";
import { useBookmarkOptional, type BookmarkItem } from "@/lib/stores/bookmark-store";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useContentTerms } from "@/lib/hooks/use-content-terms";
import { getCourseThumbnailUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const COURSE_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop&q=80";

function resolveThumbnailUrl(url: string | null): string {
  if (!url) return COURSE_PLACEHOLDER_IMAGE;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return getCourseThumbnailUrl(url) ?? COURSE_PLACEHOLDER_IMAGE;
}

type Tab = "all" | "course" | "book" | "bundle";

function buildTabs(
  terms: ContentTerms,
): { key: Tab; label: string; icon: React.ElementType }[] {
  return [
    { key: "all", label: "All", icon: Bookmark },
    { key: "course", label: terms.course.plural, icon: GraduationCap },
    { key: "book", label: terms.book.plural, icon: BookOpen },
    { key: "bundle", label: terms.bundle.plural, icon: Package },
  ];
}

function BookmarkCard({
  item,
  onRemove,
  onClick,
}: {
  item: BookmarkItem;
  onRemove: (item: BookmarkItem) => void;
  onClick: (item: BookmarkItem) => void;
}) {
  const terms = useContentTerms();
  const typeLabel =
    item.productType === "course"
      ? terms.course.singular
      : item.productType === "book"
        ? terms.book.singular
        : terms.bundle.singular;

  const typeBadgeColor =
    item.productType === "course"
      ? "bg-blue-500/10 text-blue-500"
      : item.productType === "book"
        ? "bg-emerald-500/10 text-emerald-500"
        : "bg-purple-500/10 text-purple-500";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item);
        }}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
        aria-label="Remove bookmark"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => onClick(item)}
        className="text-left"
      >
        <div
          className={cn(
            "w-full overflow-hidden bg-muted",
            item.productType === "book" ? "aspect-[3/4]" : "aspect-video"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveThumbnailUrl(item.thumbnailUrl)}
            alt={decodeHtmlEntities(item.title)}
            className={cn(
              "h-full w-full transition-transform duration-300 group-hover:scale-105",
              item.productType === "book" ? "object-contain" : "object-cover"
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).src = COURSE_PLACEHOLDER_IMAGE;
            }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                typeBadgeColor
              )}
            >
              {typeLabel}
            </span>
          </div>
          <h3 className="font-semibold leading-snug line-clamp-2">{decodeHtmlEntities(item.title)}</h3>
          {item.subtitle && (
            <p className="text-sm text-muted-foreground line-clamp-1">{decodeHtmlEntities(item.subtitle)}</p>
          )}
        </div>
      </button>
    </div>
  );
}

interface BookmarkPageSectionProps {
  section: SectionConfig;
}

export function BookmarkPageSection({ section }: BookmarkPageSectionProps) {
  const terms = useContentTerms();
  const content = section.content as BookmarkPageContent;
  const router = useRouter();
  const bookmark = useBookmarkOptional();
  const { isAuthenticated } = useUserAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const headline = content?.headline ?? "Your Bookmarks";
  const subheadline =
    content?.subheadline ?? "Courses and content you've saved for later";
  const emptyBookmarkMessage =
    content?.emptyBookmarkMessage ?? "No bookmarks yet. Save courses to find them here!";

  const hasCustomBg = hasCustomSectionBackground(section);

  // When not logged in, show login prompt
  if (!isAuthenticated) {
    return (
      <section
        className={cn(
          "py-16 md:py-24",
          hasCustomBg ? "bg-transparent" : "bg-background"
        )}
      >
        <div className="container-custom">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bookmark className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {headline}
            </h1>
          </div>
          <div className="mx-auto max-w-md rounded-xl border border-dashed bg-muted/30 p-10 text-center">
            <LogIn className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Please log in to view your bookmarks.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login?redirect=/bookmark")}
              className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Log In
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!bookmark) {
    return (
      <section
        className={cn(
          "py-16 md:py-24",
          hasCustomBg ? "bg-transparent" : "bg-background"
        )}
      >
        <div className="container-custom">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {headline}
            </h1>
            {subheadline && (
              <p className="text-muted-foreground mt-3 text-base">{subheadline}</p>
            )}
          </div>
          <div className="mx-auto max-w-md rounded-xl border border-dashed bg-muted/30 p-10 text-center">
            <p className="text-muted-foreground">{emptyBookmarkMessage}</p>
          </div>
        </div>
      </section>
    );
  }

  const { items, toggleBookmark } = bookmark;
  const tabs = buildTabs(terms);

  const filteredItems =
    activeTab === "all"
      ? items
      : items.filter((item) => item.productType === activeTab);

  const courseCount = items.filter((i) => i.productType === "course").length;
  const bookCount = items.filter((i) => i.productType === "book").length;
  const bundleCount = items.filter((i) => i.productType === "bundle").length;

  const getCount = (tab: Tab) => {
    switch (tab) {
      case "all":
        return items.length;
      case "course":
        return courseCount;
      case "book":
        return bookCount;
      case "bundle":
        return bundleCount;
    }
  };

  const handleNavigate = (item: BookmarkItem) => {
    const path =
      item.productType === "course"
        ? `/courses/${item.slug}`
        : item.productType === "book"
          ? `/books/${item.slug}`
          : `/bundles/${item.slug}`;
    router.push(path);
  };

  return (
    <section
      className={cn(
        "min-h-[60vh] py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background"
      )}
    >
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {headline}
              </h1>
              {subheadline && (
                <p className="text-muted-foreground mt-0.5 text-sm">{subheadline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 overflow-x-auto border-b pb-px">
          {tabs.map((tab) => {
            const count = getCount(tab.key);
            // Hide tabs with 0 items (except "all")
            if (tab.key !== "all" && count === 0) return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-xs",
                    activeTab === tab.key
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {filteredItems.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed bg-muted/30 p-10 text-center">
            <Bookmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {activeTab === "all"
                ? emptyBookmarkMessage
                : `No ${(activeTab === "course" ? terms.course.plural : activeTab === "book" ? terms.book.plural : terms.bundle.plural).toLowerCase()} bookmarked yet.`}
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse Content
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <BookmarkCard
                key={`${item.productType}-${item.productId}`}
                item={item}
                onRemove={toggleBookmark}
                onClick={handleNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

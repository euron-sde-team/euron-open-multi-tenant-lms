"use client";

import { formatBatchCourseLabel, formatBatchItemType } from "@open-mtlms/shared";
import { BookOpen, CalendarDays, CheckCircle2, GraduationCap } from "lucide-react";

import { BatchAboutCta } from "@/components/batch/BatchAboutCta";
import type { PublishedBatchDetail } from "@/lib/api/batches";
import { decodeHtmlEntities } from "@/lib/utils";

interface Props {
  slug: string;
  batch: PublishedBatchDetail;
  tenantName?: string;
}

/**
 * Public marketing surface. Two-column layout on `lg` and up:
 *   left, hero thumbnail, title, description, learning outcomes, items
 *   right, sticky pricing card (matches the courses-detail layout)
 *
 * On smaller screens we collapse to a single column with the pricing card
 * inline below the hero copy. The pricing block carries an `id="pricing"`
 * anchor so the Overview tab's "Join Batch" CTA can scroll-link straight
 * into it.
 */
export function BatchAboutTab({ slug, batch }: Props) {
  // batch.startDate is a date-only field stored as UTC midnight, format in
  // UTC so viewers in negative-UTC tz don't see it shift to the previous day.
  const startDateLabel = new Date(batch.startDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  // How long access lasts, mirroring the backend grant precedence:
  // end_date > duration_days > validity_days > lifetime (all null). The card
  // previously hardcoded "Lifetime cohort access", which misled buyers of a
  // batch that actually expires.
  const accessLabel = (() => {
    if (batch.endDate) {
      const until = new Date(batch.endDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return `Cohort access until ${until}`;
    }
    if (batch.durationDays != null)
      return `${batch.durationDays} days cohort access`;
    if (batch.validityDays != null)
      return `${batch.validityDays} days cohort access`;
    return "Lifetime cohort access";
  })();

  const heroImage =
    batch.coverImageUrl || batch.webThumbnailUrl || batch.thumbnailUrl;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Left column, hero + copy + items. */}
      <div>
        {heroImage && (
          // Web thumbnail is uploaded at 16:9, render the hero in the same
          // aspect so it never gets squashed or letterboxed differently
          // across viewports. `aspect-video` scales proportionally with the
          // container width.
          <div className="bg-muted mb-6 aspect-video w-full overflow-hidden rounded-xl border">
            <img
              src={heroImage}
              alt={batch.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-bold lg:text-4xl">{batch.title}</h1>
          {batch.subtitle && (
            <p className="text-muted-foreground text-lg">{batch.subtitle}</p>
          )}
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Starts {startDateLabel}
            </span>
          </div>
        </div>

        {batch.description && (
          <div className="prose prose-sm dark:prose-invert mb-10 max-w-3xl whitespace-pre-line">
            <p>{batch.description}</p>
          </div>
        )}

        {/* Inline pricing card on small screens, collapses below the copy
            so the Join CTA is visible without a horizontal split. The
            sticky variant on the right column is hidden below `lg`. */}
        <div id="pricing" className="scroll-mt-24 lg:hidden">
          <BatchAboutCta
            slug={slug}
            batchId={batch.id}
            title={decodeHtmlEntities(batch.title)}
            purchaseMode={batch.purchaseMode}
            priceInr={batch.priceInr}
            priceUsd={batch.priceUsd}
            discountInr={batch.discountInr}
            discountUsd={batch.discountUsd}
            prices={
              (batch as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                .prices ?? null
            }
            accessLabel={accessLabel}
          />
        </div>

        {batch.learningOutcomes.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">
              What you&apos;ll learn
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {batch.learningOutcomes.map((outcome, idx) => (
                <li
                  key={idx}
                  className="bg-primary/5 border-primary/15 flex items-start gap-3 rounded-lg border p-3 text-sm"
                >
                  <span className="bg-primary/15 text-primary flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="leading-snug">{outcome}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mb-4 text-xl font-semibold">What&apos;s included</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {batch.items.map((item) => {
            const isCourse = item.itemType === "COURSE";
            const title = isCourse ? item.courseTitle : item.bookTitle;
            const thumbnail = isCourse
              ? item.courseThumbnailKey
              : item.bookThumbnailUrl;
            return (
              <li
                key={item.id}
                className="bg-card hover:border-primary/30 group relative flex items-start gap-3 overflow-hidden rounded-lg border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${
                    isCourse ? "bg-primary/60" : "bg-muted-foreground/40"
                  }`}
                  aria-hidden
                />
                <div className="bg-muted aspect-video h-auto w-28 flex-shrink-0 overflow-hidden rounded-md">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                      {isCourse ? (
                        <GraduationCap className="h-5 w-5" />
                      ) : (
                        <BookOpen className="h-5 w-5" />
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs uppercase tracking-wide">
                    {isCourse ? (
                      <GraduationCap className="h-3 w-3" />
                    ) : (
                      <BookOpen className="h-3 w-3" />
                    )}
                    {formatBatchItemType(item.itemType)}
                    {isCourse
                      ? (() => {
                          const label = formatBatchCourseLabel(
                            item.courseMode,
                            item.courseType
                          );
                          return label ? ` · ${label}` : "";
                        })()
                      : ""}
                  </div>
                  <div className="line-clamp-2 font-medium">{title}</div>
                  {item.courseSubtitle && (
                    <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {item.courseSubtitle}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right column, sticky pricing card on lg+ only; the small-screen
          version is rendered inline above. */}
      <aside id="pricing-desktop" className="hidden lg:block">
        <div className="sticky top-24 scroll-mt-24">
          <BatchAboutCta
            slug={slug}
            batchId={batch.id}
            title={decodeHtmlEntities(batch.title)}
            purchaseMode={batch.purchaseMode}
            priceInr={batch.priceInr}
            priceUsd={batch.priceUsd}
            discountInr={batch.discountInr}
            discountUsd={batch.discountUsd}
            prices={
              (batch as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                .prices ?? null
            }
            startDateLabel={startDateLabel}
            accessLabel={accessLabel}
          />
        </div>
      </aside>
    </div>
  );
}

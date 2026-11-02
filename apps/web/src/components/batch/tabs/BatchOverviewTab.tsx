"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { decodeHtmlEntities } from "@/lib/utils";

import {
  fetchBatchDashboard,
  type PublishedBatchDetail,
} from "@/lib/api/batches";
import { useContentTerm } from "@/lib/hooks/use-content-terms";

interface Props {
  slug: string;
  batch: PublishedBatchDetail;
}

function formatCountdown(seconds: number): {
  days: number;
  hours: number;
  minutes: number;
  secs: number;
} {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return { days, hours, minutes, secs };
}

/**
 * Overview tab, the landing surface for enrolled learners. For non-enrolled
 * visitors the dashboard endpoint 403s, so we render a teaser-only view with
 * the hero countdown + "Join Batch" CTA that points back to the About tab's
 * pricing block. For enrolled members we layer progress widgets below the
 * hero.
 */
export function BatchOverviewTab({ slug, batch }: Props) {
  const batchTerm = useContentTerm("batch");
  const heroImage =
    batch.webThumbnailUrl || batch.coverImageUrl || batch.thumbnailUrl;

  const { data, isLoading } = useQuery({
    queryKey: ["batch-dashboard", slug],
    queryFn: () => fetchBatchDashboard(slug),
    enabled: !!slug,
    retry: false,
    // Cache across tab switches, the user can flip back and forth between
    // Overview and any other tab without triggering refetch shimmer every
    // time. 60s is enough that a normal browse never reloads the dashboard.
    staleTime: 60_000,
  });

  const hasAccess = !!batch.hasAccess;

  // Local-tick countdown, re-renders every second once mounted.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // batch.startDate is a date-only column stored as UTC midnight. The
  // viewer's "start of the day" is **local midnight on that calendar
  // date**, i.e. for a "starts May 2" cohort, the countdown should hit
  // zero at 12:00 AM May 2 in whatever timezone the browser is set to.
  // We extract the YYYY-MM-DD parts in UTC (which are the parts the admin
  // picked) and rebuild the Date with the local-tz midnight constructor.
  const startDateOnly = new Date(batch.startDate);
  const startLocalMidnight = new Date(
    startDateOnly.getUTCFullYear(),
    startDateOnly.getUTCMonth(),
    startDateOnly.getUTCDate(),
    0,
    0,
    0,
    0
  );
  const startsAtMs = startLocalMidnight.getTime();
  const remainingSeconds = Math.max(0, Math.floor((startsAtMs - now) / 1000));
  const c = formatCountdown(remainingSeconds);
  const startLabel = startLocalMidnight.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const hasStarted = startsAtMs <= now;

  return (
    <div className="space-y-8">
      {/* Hero, web thumbnail as a softly-blurred background plus layered
          gradients so the foreground text reads on any image. The radial
          glow + bottom fade give the panel some depth instead of looking
          like a flat dark rectangle. */}
      <section className="relative overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{
            backgroundImage: heroImage ? `url(${heroImage})` : undefined,
            filter: heroImage ? "blur(8px) brightness(0.45)" : undefined,
            transform: heroImage ? "scale(1.08)" : undefined,
          }}
          aria-hidden
        />
        {/* Vertical fade, keeps the bottom CTA area readable. */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/85"
          aria-hidden
        />
        {/* Soft brand-tinted radial spotlight from top-left for depth. */}
        <div
          className="absolute inset-0 opacity-60 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 0%, hsl(var(--primary) / 0.45), transparent 55%)",
          }}
          aria-hidden
        />
        {!heroImage && (
          <div className="bg-primary/10 absolute inset-0" aria-hidden />
        )}

        <div className="relative flex flex-col items-center px-4 py-14 text-center sm:px-10 sm:py-20 lg:py-24">
          {/* Eyebrow tag, small, but signals "this is a cohort" before the
              big title. */}
          <span className="text-primary mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            Live cohort
          </span>

          <h1 className="text-2xl font-bold text-white drop-shadow-md sm:text-3xl lg:text-5xl">
            {decodeHtmlEntities(batch.title)}
          </h1>
          {batch.subtitle && (
            <p className="mt-3 max-w-2xl text-sm text-white/90 drop-shadow sm:text-base">
              {decodeHtmlEntities(batch.subtitle)}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" />
              {hasStarted ? "Live since" : "Starts on"} {startLabel}
            </span>
          </div>

          {/* Countdown is always visible. While the cohort is upcoming the
              digits tick down; once it's live we show a "Live now" badge in
              the same slot so the layout doesn't jump. */}
          {hasStarted ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Cohort is live
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <CountdownCell value={c.days} label="days" />
              <CountdownCell value={c.hours} label="hours" />
              <CountdownCell value={c.minutes} label="mins" />
              <CountdownCell value={c.secs} label="secs" />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {hasAccess ? (
              <>
                <Button asChild size="lg" variant="secondary">
                  <Link href={`/batches/${slug}?tab=calendar`}>
                    Open Calendar
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/15"
                >
                  <Link href={`/batches/${slug}?tab=content`}>
                    Browse Content
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild size="lg">
                <Link href={`/batches/${slug}?tab=about`}>
                  Join {batchTerm.singular}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats, visible to everyone. The dashboard endpoint returns the
          batch-wide counters (total lessons) for visitors
          and the member-specific counters (completed) for
          enrolled learners. Visitors see "Your progress" with 0/0 values,
          which doubles as a preview of what they'd see post-enrollment. */}
      {isLoading && <ProgressSkeleton />}

      {data && (
        <>
          <h2 className="text-lg font-semibold">
            {hasAccess ? "Your progress" : `${batchTerm.singular} progress`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 ">
            <ProgressCard
              icon={<GraduationCap className="h-5 w-5" />}
              label={hasAccess ? "Lessons completed" : "Your completion"}
              value={`${data.progress.lessonsCompleted}/${data.progress.totalLessons}`}
              pct={data.progress.lessonCompletionPct}
            />
            <ProgressCard
              icon={<Trophy className="h-5 w-5" />}
              label="Overall completion"
              value={`${data.progress.overallCompletionPct}%`}
              pct={data.progress.overallCompletionPct}
            />
          </div>

        </>
      )}
    </div>
  );
}

/**
 * Shimmer rows for the progress section, keeps the page from collapsing
 * while the dashboard fetch is in flight.
 */
function ProgressSkeleton() {
  return (
    <>
      <div className="bg-muted h-5 w-40 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="bg-muted h-5 w-5 animate-pulse rounded" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                <div className="bg-muted h-5 w-16 animate-pulse rounded" />
              </div>
              <div className="bg-muted h-14 w-14 animate-pulse rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function CountdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="rounded-md border border-white/20 bg-white/15 px-4 py-3 text-2xl font-mono font-semibold text-white backdrop-blur sm:text-3xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-white/80">
        {label}
      </div>
    </div>
  );
}

function ProgressCard({
  icon,
  label,
  value,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct: number | null;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const safePct = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const offset = circumference - (safePct / 100) * circumference;
  return (
    <Card className="hover:border-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-4 py-5">
        <span className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">
            {label}
          </div>
          <div className="truncate text-lg font-semibold">{value}</div>
        </div>
        {pct != null && (
          <svg width="56" height="56" viewBox="0 0 100 100" className="flex-shrink-0">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="none"
              className="text-muted/30"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              className="text-primary transition-all duration-500"
              strokeLinecap="round"
            />
            <text
              x="50"
              y="56"
              textAnchor="middle"
              fontSize="22"
              className="fill-foreground font-semibold"
            >
              {Math.round(safePct)}%
            </text>
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

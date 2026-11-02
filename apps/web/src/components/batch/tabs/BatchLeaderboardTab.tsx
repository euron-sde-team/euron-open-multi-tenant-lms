"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { Award, Medal, Trophy } from "lucide-react";
import Link from "next/link";

import { fetchBatchLeaderboard } from "@/lib/api/batches";
import { useContentTerm } from "@/lib/hooks/use-content-terms";

interface Props {
  slug: string;
  hasAccess: boolean;
}

/**
 * Leaderboard tab, top-N learners scored on attendance + completion. The
 * snapshot is recomputed by a background worker; if the worker hasn't
 * produced a snapshot yet (or no learners have logged any activity), we
 * surface a friendly "leaderboard hasn't been prepared yet" empty state
 * rather than a generic loading spinner forever.
 */
export function BatchLeaderboardTab({ slug, hasAccess }: Props) {
  const batchTerm = useContentTerm("batch");
  const { data, isLoading, error } = useQuery({
    queryKey: ["batch-leaderboard", slug],
    queryFn: () => fetchBatchLeaderboard(slug),
    enabled: !!slug,
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <>
        <Header />
        <LeaderboardSkeleton />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header />
        <ComingSoon />
      </>
    );
  }

  const hasParticipants = data.snapshot.totalParticipants > 0;
  const hasTopN = data.snapshot.topN.length > 0;

  if (!hasParticipants || !hasTopN) {
    return (
      <>
        <Header />
        <ComingSoon />
      </>
    );
  }

  const myMemberId = data.me?.memberId ?? null;
  const meIsInTopN = myMemberId
    ? data.snapshot.topN.some((e) => e.memberId === myMemberId)
    : false;

  return (
    <>
      <Header />

      {!hasAccess && (
        <div className="bg-primary/5 text-foreground border-primary/20 mb-4 flex flex-col items-start justify-between gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center">
          <span className="text-muted-foreground">
            Preview only. Join the {batchTerm.singular.toLowerCase()} to climb the leaderboard.
          </span>
          <Button asChild size="sm">
            <Link href={`/batches/${slug}?tab=about`}>Join {batchTerm.singular}</Link>
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                  <th className="px-3 py-3 sm:px-4">Rank</th>
                  <th className="px-3 py-3 sm:px-4">Learner</th>
                  <th className="hidden px-3 py-3 text-right sm:table-cell sm:px-4">
                    Completed
                  </th>
                  <th className="px-3 py-3 text-right sm:px-4">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.snapshot.topN.map((e) => {
                  const isMe = !!myMemberId && e.memberId === myMemberId;
                  // Soft primary tint for the top-3 stripe; "me" highlight
                  // takes precedence so a learner ranked #4+ still sees
                  // their own row stand out.
                  const isTopThree = e.rank <= 3;
                  const rowTint = isMe
                    ? "bg-primary/10 font-semibold"
                    : isTopThree
                      ? "bg-primary/[0.04]"
                      : "";
                  return (
                    <tr
                      key={e.memberId}
                      className={`${rowTint} hover:bg-muted/40 transition-colors`}
                    >
                      <td className="px-3 py-3 sm:px-4">
                        <RankBadge rank={e.rank} />
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/15 text-primary flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                            {initials(e.displayName)}
                          </div>
                          <span className="truncate">{e.displayName}</span>
                          {isMe && (
                            <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell sm:px-4">
                        {e.lessonsCompleted}
                        <span className="text-muted-foreground">
                          /{e.totalLessons}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums sm:px-4">
                        {e.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {data.me && !meIsInTopN && (
          <Card>
            <CardContent className="flex flex-col items-start justify-between gap-1 py-3 sm:flex-row sm:items-center">
              <span className="font-medium">
                You · #{data.me.rank} of {data.snapshot.totalParticipants}
              </span>
              <span className="text-muted-foreground text-sm">
                Score: {data.me.score}
              </span>
            </CardContent>
          </Card>
        )}
        <p className="text-muted-foreground text-xs">
          Last updated{" "}
          {new Date(data.snapshot.computedAt).toLocaleTimeString()}
        </p>
      </div>
    </>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <span className="bg-primary/10 text-primary inline-flex h-9 w-9 items-center justify-center rounded-full">
          <Trophy className="h-5 w-5" />
        </span>
        Leaderboard
      </h1>
      <p className="text-muted-foreground text-sm">
        Top learners in the cohort ranked by live class attendance and lesson
        progress.
      </p>
    </div>
  );
}

/**
 * Visual rank cell, gold/silver/bronze medal icons for the top 3, plain
 * "#N" for everyone else. Medal colors are intentionally fixed (not theme
 * tokens) because they're a universal podium convention and only show up as
 * tiny accent glyphs.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-500">
        <Trophy className="h-4 w-4" /> #1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400">
        <Medal className="h-4 w-4" /> #2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-orange-600">
        <Award className="h-4 w-4" /> #3
      </span>
    );
  }
  return <span className="text-muted-foreground tabular-nums">#{rank}</span>;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Minimal "coming soon" placeholder, a faint primary-tinted glow behind a
 * subdued trophy. Both "no snapshot yet" and "no participants" funnel into
 * this so the tab never looks broken or busy with explanatory text.
 */
function ComingSoon() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative flex flex-col items-center py-20 text-center">
        <div
          className="bg-primary/10 pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 30%, hsl(var(--primary) / 0.15), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="bg-primary/10 ring-primary/20 relative mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full ring-1">
          <Trophy className="text-primary h-8 w-8" />
        </div>
        <p className="text-foreground relative text-base font-semibold">
          Coming soon
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Shimmer placeholder mirroring the real leaderboard layout, header row +
 * 6 skeleton rows. Keeps the page from collapsing while the snapshot is
 * fetched and avoids the "blank page → spinner" jank.
 */
function LeaderboardSkeleton() {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <div className="min-w-[480px] divide-y">
          <div className="grid grid-cols-12 gap-3 px-3 py-3 sm:px-4">
            <div className="bg-muted col-span-2 h-3 animate-pulse rounded" />
            <div className="bg-muted col-span-5 h-3 animate-pulse rounded" />
            <div className="bg-muted col-span-2 h-3 animate-pulse rounded justify-self-end" />
            <div className="bg-muted col-span-3 h-3 animate-pulse rounded justify-self-end" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-3 px-3 py-4 sm:px-4"
            >
              <div className="bg-muted col-span-2 h-3 w-8 animate-pulse rounded" />
              <div className="col-span-5 flex items-center gap-2">
                <div className="bg-muted h-7 w-7 animate-pulse rounded-full" />
                <div className="bg-muted h-3 flex-1 animate-pulse rounded" />
              </div>
              <div className="bg-muted col-span-2 h-3 w-12 animate-pulse rounded justify-self-end" />
              <div className="bg-muted col-span-3 h-3 w-10 animate-pulse rounded justify-self-end" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

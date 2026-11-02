"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import { Activity } from "lucide-react";

import { useAdaptiveHealth } from "@/lib/hooks/use-test-series";

function pathLabel(pathKey: string): string {
  if (!pathKey) return "Single stage";
  return pathKey
    .split(">")
    .map((v) => v.charAt(0) + v.slice(1).toLowerCase())
    .join(" > ");
}

/**
 * Routing-distribution health for a published adaptive test. The split
 * across stage 2 variants is the main threshold-calibration signal: a
 * lopsided split (under ~10% or over ~90% routed to one variant) usually
 * means the routing threshold or module 1 difficulty needs adjusting.
 */
export function AdaptiveHealthCard({ testId }: { testId: string }) {
  const { data, isLoading } = useAdaptiveHealth(testId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="text-muted-foreground h-4 w-4" />
            Adaptive health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {[0, 1].map((i) => (
            <div key={i} className="bg-muted h-5 w-full animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="text-muted-foreground h-4 w-4" />
          Adaptive health
          <span className="text-muted-foreground text-xs font-normal">
            {data.totalAttempts} submitted attempt
            {data.totalAttempts === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {data.totalAttempts === 0 ? (
          <p className="text-muted-foreground text-sm">
            No submitted attempts yet. Routing distribution appears here once
            learners finish the test.
          </p>
        ) : (
          data.sections.map((sec) => {
            const lopsided = sec.paths.some((p) => p.pct >= 90 || p.pct <= 10);
            return (
              <div key={sec.sectionId}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{sec.sectionName}</p>
                  {lopsided && sec.paths.length > 1 && (
                    <span className="text-amber-600 text-xs">
                      Lopsided routing: check the threshold
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {sec.paths.map((p) => (
                    <div key={p.pathKey || "single"}>
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {pathLabel(p.pathKey)}
                        </span>
                        <span className="text-foreground tabular-nums">
                          {p.count} · {p.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${Math.min(100, p.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-3 text-xs">
                  {sec.modules.map((m) => (
                    <span key={m.moduleId}>
                      S{m.stageNo}{" "}
                      {m.variant.charAt(0) + m.variant.slice(1).toLowerCase()}: avg{" "}
                      {m.avgRawCorrect ?? "-"}/{m.questionCount}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

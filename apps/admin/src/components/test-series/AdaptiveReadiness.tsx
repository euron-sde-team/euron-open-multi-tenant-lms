"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

import type { TestModulesResponse, TestSection } from "@/lib/api/test-series";

interface AdaptiveReadinessProps {
  sections: TestSection[];
  data: TestModulesResponse;
  published: boolean;
}

function moduleLabel(variant: string, stageNo: number): string {
  if (stageNo === 1 || variant === "ROUTING") return "Module 1";
  const v = variant.charAt(0) + variant.slice(1).toLowerCase();
  return `Module 2 · ${v}`;
}

/**
 * Proactive "what's left to publish" checklist for an adaptive test, computed
 * entirely from data already loaded (modules + their pools, score scales, the
 * percentile table). Pools are required; score conversion and the percentile
 * chart are recommended, mirroring the server publish rules.
 */
export function AdaptiveReadiness({ sections, data, published }: AdaptiveReadinessProps) {
  const sectionRows = sections
    .map((section) => {
      const modules = data.modules
        .filter((m) => m.sectionId === section.id)
        .sort(
          (a, b) => a.stageNo - b.stageNo || a.difficultyRank - b.difficultyRank
        );
      if (modules.length === 0) return null;
      const moduleRows = modules.map((m) => {
        const scored = m.questions.filter((q) => !q.isPretest).length;
        return {
          id: m.id,
          label: moduleLabel(m.variant, m.stageNo),
          scored,
          need: m.questionCount,
          ok: scored >= m.questionCount,
        };
      });
      return {
        sectionId: section.id,
        name: section.name,
        moduleRows,
        hasScale: data.scoreScales.some((s) => s.sectionId === section.id),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (sectionRows.length === 0) return null;

  const incompleteModules = sectionRows.reduce(
    (acc, s) => acc + s.moduleRows.filter((m) => !m.ok).length,
    0
  );
  const poolsReady = incompleteModules === 0;
  const hasNorm = Boolean(data.normTable);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {poolsReady ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          {published
            ? "Published"
            : poolsReady
              ? "Ready to publish"
              : `${incompleteModules} module${
                  incompleteModules === 1 ? "" : "s"
                } still need questions`}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Every module needs enough questions in its pool. Score conversion and the
          percentile chart are recommended for SAT-style scoring.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {sectionRows.map((s) => (
          <div key={s.sectionId} className="rounded-md border p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.name}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  s.hasScale
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                {s.hasScale ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                Score conversion {s.hasScale ? "set" : "not set"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.moduleRows.map((m) => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    m.ok
                      ? "border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300"
                      : "border-amber-300 text-amber-700 dark:border-amber-900/50 dark:text-amber-300"
                  }`}
                >
                  {m.ok ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {m.label}: {m.scored}/{m.need}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div
          className={`inline-flex items-center gap-1 text-xs ${
            hasNorm
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
          }`}
        >
          {hasNorm ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
          Percentile chart {hasNorm ? "set" : "not set (optional)"}
        </div>
      </CardContent>
    </Card>
  );
}

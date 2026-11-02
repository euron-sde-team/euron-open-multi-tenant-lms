"use client";

import { Badge, Button, Card, CardContent } from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calculator, Target, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  testPerformanceApi,
  type PerfBucket,
} from "@/lib/api/test-performance";
import { useUserAuthStore } from "@/lib/stores/auth-store";

function accuracyColor(a: number): string {
  if (a >= 80) return "bg-emerald-500";
  if (a >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function AccuracyBars({ title, items }: { title: string; items: PerfBucket[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-foreground text-sm font-semibold">{title}</h3>
        <div className="space-y-2.5">
          {items.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-foreground truncate font-medium">{b.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {b.correct}/{b.total} · {b.accuracy}%
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${accuracyColor(b.accuracy)} transition-[width] duration-500`}
                  style={{ width: `${Math.min(100, b.accuracy)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">{label}</div>
      </CardContent>
    </Card>
  );
}

function StrengthList({
  title,
  items,
  icon,
}: {
  title: string;
  items: PerfBucket[];
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {icon} {title}
        </h3>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-xs">Not enough data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{b.label}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {b.accuracy}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCalculator() {
  const [rw, setRw] = useState({ raw: 0, total: 27 });
  const [math, setMath] = useState({ raw: 0, total: 22 });
  const [result, setResult] = useState<{ rw: number; math: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    setBusy(true);
    try {
      const r = await testPerformanceApi.scoreCalculator([
        { name: "Reading and Writing", rawCorrect: rw.raw, totalQuestions: rw.total },
        { name: "Math", rawCorrect: math.raw, totalQuestions: math.total },
      ]);
      setResult({
        rw: r.sections[0]?.scaled ?? 0,
        math: r.sections[1]?.scaled ?? 0,
        total: r.total,
      });
    } catch {
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const Field = ({
    label,
    v,
    set,
  }: {
    label: string;
    v: { raw: number; total: number };
    set: (x: { raw: number; total: number }) => void;
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-foreground w-36 text-sm font-medium">{label}</span>
      <input
        type="number"
        min={0}
        max={v.total}
        value={v.raw}
        onChange={(e) => set({ ...v, raw: Math.max(0, Math.min(v.total, +e.target.value || 0)) })}
        className="border-border bg-background w-16 rounded-md border px-2 py-1 text-sm"
        aria-label={`${label} correct`}
      />
      <span className="text-muted-foreground text-sm">/ {v.total} correct</span>
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4" /> Score calculator
        </h3>
        <p className="text-muted-foreground text-xs">
          Estimate your Digital SAT score (200–800 per section) from raw correct counts.
        </p>
        <div className="space-y-2">
          <Field label="Reading & Writing" v={rw} set={setRw} />
          <Field label="Math" v={math} set={setMath} />
        </div>
        <Button size="sm" onClick={calc} disabled={busy}>
          {busy ? "Calculating…" : "Estimate score"}
        </Button>
        {result && (
          <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg p-3 text-center">
            <div>
              <div className="text-muted-foreground text-[10px] uppercase">R&amp;W</div>
              <div className="text-foreground text-lg font-bold">{result.rw}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] uppercase">Math</div>
              <div className="text-foreground text-lg font-bold">{result.math}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px] uppercase">Total</div>
              <div className="text-primary text-lg font-bold">{result.total}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({
  data,
}: {
  data: {
    source: "TEST" | "PRACTICE";
    id: string;
    title: string | null;
    score: number | null;
    totalMarks: number | null;
    at: string;
  }[];
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-foreground text-sm font-semibold">Recent activity</h3>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-xs">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {data.map((a) => (
              <div
                key={`${a.source}-${a.id}`}
                className="border-border/60 flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-foreground truncate font-medium">
                    {a.title ?? (a.source === "PRACTICE" ? "Practice session" : "Test")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {a.source === "PRACTICE" ? "Practice" : "Test"} ·{" "}
                    {new Date(a.at).toLocaleDateString()}
                  </div>
                </div>
                {a.score != null && (
                  <span className="text-foreground shrink-0 font-mono text-sm font-semibold">
                    {a.score}
                    {a.totalMarks != null ? `/${a.totalMarks}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * SAT test + practice analytics panel. Reused by the standalone
 * /test-series/performance page AND the profile "Analytics" tab.
 */
/**
 * @param hideWhenEmpty When true, render nothing if the learner has no test
 *   activity. Used in the profile so the SAT panel only auto-appears for
 *   SAT-enabled tenants whose student has actually attempted, there's no
 *   point showing it otherwise. The standalone /performance page keeps the
 *   friendly empty state instead.
 */
export function TestPerformancePanel({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean }) {
  const isAuthed = useUserAuthStore((s) => s.isAuthenticated);
  const { data, isLoading } = useQuery({
    queryKey: ["test-performance-dashboard"],
    queryFn: () => testPerformanceApi.dashboard(),
    enabled: isAuthed,
  });

  const isEmpty = !data || data.overall.questionsAnswered === 0;
  if (hideWhenEmpty && (isLoading || !isAuthed || isEmpty)) {
    return null;
  }

  if (!isAuthed) {
    return <p className="text-muted-foreground text-sm">Sign in to see your test analytics.</p>;
  }
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading your test analytics…</p>;
  }
  if (isEmpty) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
          <p className="text-foreground font-medium">No test attempts yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Take a test or practice session and your SAT analytics will appear here.
          </p>
          <Link href="/test-series">
            <Button className="mt-4" size="sm">
              Browse tests
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-xl font-semibold tracking-tight">SAT Performance</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Across every test and practice session.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Questions answered" value={data.overall.questionsAnswered} />
        <StatCard label="Correct" value={data.overall.correct} />
        <StatCard label="Overall accuracy" value={`${data.overall.accuracy}%`} accent />
        <StatCard label="Tests + practice" value={data.recentActivity.length} />
      </div>

      {data.recommendations.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2 p-5">
            <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4" /> Recommended focus
            </h3>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {data.recommendations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <StrengthList
          title="Strengths"
          items={data.strengths}
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
        />
        <StrengthList
          title="Needs work"
          items={data.weaknesses}
          icon={<TrendingDown className="text-rose-600 h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AccuracyBars title="By subject" items={data.bySubject} />
        <AccuracyBars title="By difficulty" items={data.byDifficulty} />
        <AccuracyBars title="By domain" items={data.byDomain} />
        <AccuracyBars title="By skill" items={data.bySkill.slice(0, 8)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreCalculator />
        <RecentActivity data={data.recentActivity} />
      </div>
    </div>
  );
}

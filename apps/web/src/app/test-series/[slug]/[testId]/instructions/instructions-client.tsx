"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Accessibility,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Hourglass,
  Loader2,
  ShieldAlert,
  Unlock,
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, SkeletonRows, useToast } from "@open-mtlms/core";
import type { ThemeConfig, TenantLayout } from "@open-mtlms/shared";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { useDevicePrecheck } from "@/lib/hooks/use-device-precheck";
import {
  useStartTestAttempt,
  useTestSeriesDetail,
} from "@/lib/hooks/use-test-series";

interface Props {
  slug: string;
  testId: string;
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

export function InstructionsClient({ slug, testId, theme, layout }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);

  const { data: series, isLoading } = useTestSeriesDetail(slug);
  const startMutation = useStartTestAttempt();

  const test = useMemo(
    () => series?.tests.find((t) => t.id === testId) ?? null,
    [series, testId]
  );

  // Bluebook flow: stays true through the redirect so the "Preparing" screen
  // covers the whole start → player transition.
  const [preparing, setPreparing] = useState(false);

  // Proctoring needs are checked HERE, before any attempt exists: the timer
  // hasn't started and nothing counts against the attempt limit yet.
  const proctoring = test?.proctoring;
  const devices = useDevicePrecheck({
    camera: Boolean(proctoring?.camera),
    mic: Boolean(proctoring?.mic),
  });
  const devicesReady = devices.status === "granted";

  const handleStart = () => {
    if (!series || !test) return;
    if (!devicesReady) {
      toast({
        title: "Device access required",
        description: `Allow access to your ${devices.what} before starting this test.`,
        variant: "destructive",
      });
      return;
    }
    // Fullscreen is only granted from a click, so ask in this one. The player's
    // own request ran on first render, which browsers silently refuse.
    if (proctoring?.fullscreen) {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const fn = el.requestFullscreen ?? el.webkitRequestFullscreen;
      if (fn) void fn.call(el).catch(() => undefined);
    }
    const isAdaptive = test.mode === "ADAPTIVE";
    if (!isAdaptive && !agreed) {
      toast({
        title: "Declaration required",
        description: "You must agree to the declaration before starting.",
        variant: "destructive",
      });
      return;
    }
    if (isAdaptive) setPreparing(true);
    startMutation.mutate(
      { testId, seriesId: series.id },
      {
        onSuccess: (data) => {
          router.push(`/test-series/${slug}/${testId}/attempt/${data.attemptId}`);
        },
        onError: (err) => {
          setPreparing(false);
          toast({
            title: "Could not start",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-3xl px-4 py-8">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-9 w-2/3" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <SkeletonRows rows={4} rowClassName="h-10" className="mt-6" />
            <Skeleton className="mt-6 h-12 w-full" />
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  if (!series || !test) {
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
            <h1 className="text-foreground text-2xl font-bold">Test not found</h1>
            <Link href="/test-series">
              <Button variant="outline" className="mt-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to catalog
              </Button>
            </Link>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  // ---- Bluebook start flow for adaptive (Digital SAT) tests ----
  if (test.mode === "ADAPTIVE") {
    if (preparing) {
      // "We're Preparing Your Practice Test" interstitial, covers attempt
      // creation and the redirect into the player.
      return (
        <TenantThemeProvider theme={theme}>
          <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
            <h1 className="text-foreground text-center text-2xl font-bold sm:text-3xl">
              We&apos;re Preparing Your Practice Test
            </h1>
            <div className="border-border bg-card mt-8 flex w-full max-w-md flex-col items-center rounded-xl border p-10 shadow-md">
              <Hourglass className="text-primary h-16 w-16 animate-pulse" />
              <p className="text-muted-foreground mt-8 text-center text-sm leading-relaxed">
                This may take up to a minute. Please don&apos;t refresh this
                page or quit the app.
              </p>
            </div>
          </div>
        </TenantThemeProvider>
      );
    }
    return (
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="bg-background min-h-screen">
            <div className="container mx-auto max-w-2xl px-4 py-8">
              <Link
                href={`/test-series/${slug}/dashboard`}
                className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to series
              </Link>

              <h1 className="text-foreground text-center text-3xl font-bold">
                Practice Test
              </h1>

              <div className="border-border bg-card mt-8 space-y-7 rounded-xl border p-6 shadow-md sm:p-8">
                <PracticeTestInfo
                  icon={Clock}
                  title="Timing"
                  text="Practice tests are timed. Each module has its own clock, when it ends, the next module begins automatically. If you disconnect, you can rejoin and pick up where you left off."
                />
                <PracticeTestInfo
                  icon={ClipboardCheck}
                  title="Scores"
                  text="When you finish the practice test, your scores and question-by-question review are ready right away on your results page."
                />
                <PracticeTestInfo
                  icon={Accessibility}
                  title="Assistive Technology (AT)"
                  text="Be sure to practice with any assistive technology you use for testing, so test day feels familiar."
                />
                <PracticeTestInfo
                  icon={Unlock}
                  title="No Device Lock"
                  text="We don't lock your device during practice. On test day, you'll be blocked from using other programs or apps."
                />
              </div>

              {devices.required && (
                <div className="mt-6">
                  <DeviceCheck devices={devices} />
                </div>
              )}

              <div className="mt-8 flex justify-center">
                <Button
                  onClick={handleStart}
                  disabled={!devicesReady || startMutation.isPending}
                  size="lg"
                  className="rounded-full px-10"
                >
                  {startMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Start Test
                </Button>
              </div>
            </div>
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme}>
      <TenantThemeProvider theme={theme}>
        <div className="bg-background min-h-screen">
          <div className="container mx-auto max-w-2xl px-4 py-8">
            <Link
              href={`/test-series/${slug}/dashboard`}
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to series
            </Link>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{test.name}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Read the instructions carefully before starting.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="bg-muted/40 rounded-lg p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Duration
                    </p>
                    <p className="text-foreground mt-1 flex items-center gap-2 text-lg font-semibold">
                      <Clock className="h-4 w-4" />
                      {test.durationMin} min
                    </p>
                  </div>
                  {test.servedQuestionCount > 0 && (
                    <div className="bg-muted/40 rounded-lg p-4">
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">
                        Questions
                      </p>
                      <p className="text-foreground mt-1 text-lg font-semibold">
                        {test.servedQuestionCount}
                      </p>
                    </div>
                  )}
                  <div className="bg-muted/40 rounded-lg p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Total marks
                    </p>
                    <p className="text-foreground mt-1 text-lg font-semibold">
                      {test.totalMarks}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-foreground font-semibold">Test settings</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {test.shuffleQuestions && (
                      <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                        Questions shuffled
                      </span>
                    )}
                    {test.shuffleOptions && (
                      <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                        Options shuffled
                      </span>
                    )}
                    {test.allowReattempt ? (
                      <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                        Re-attempts allowed
                      </span>
                    ) : (
                      <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                        Single attempt only
                      </span>
                    )}
                    {test.passCriteriaPct != null && (
                      <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                        Pass: {test.passCriteriaPct}%
                      </span>
                    )}
                    <span className="bg-muted text-foreground rounded-md px-2 py-1 text-xs">
                      {test.showSolutions === "IMMEDIATE"
                        ? "Solutions: after submit"
                        : test.showSolutions === "AFTER_SERIES_END"
                          ? "Solutions: after series ends"
                          : "Solutions: not shown"}
                    </span>
                  </div>
                </div>

                {test.description && test.description.trim().length > 0 && (
                  <div>
                    <h3 className="text-foreground font-semibold">
                      Instructions from your instructor
                    </h3>
                    <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">
                      {test.description}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-foreground font-semibold">General instructions</h3>
                  <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
                    <li>The timer starts as soon as you click Start.</li>
                    <li>
                      Your answers are autosaved. If you get disconnected, you
                      can rejoin and resume where you left off. Your time keeps
                      running while you are away, so the test will still close
                      when your allotted time is up.
                    </li>
                    <li>
                      Use the question palette to navigate between questions.
                    </li>
                    <li>
                      You can mark a question for review and revisit it before
                      submitting.
                    </li>
                    <li>
                      The test will auto-submit when the timer reaches zero.
                    </li>
                    {proctoring?.enabled && (
                      <li>
                        This test is proctored. Leaving the test screen
                        {proctoring.fullscreen
                          ? " (switching tabs or windows, or exiting full screen)"
                          : " (switching tabs or windows)"}{" "}
                        is recorded and may end your test automatically.
                        {devices.required &&
                          ` Your ${devices.what} must stay on for the whole test.`}
                      </li>
                    )}
                  </ul>
                </div>

                {devices.required && <DeviceCheck devices={devices} />}

                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-foreground text-sm">
                    I declare that I will not engage in any unfair means
                    (looking up answers, copying, or sharing the test
                    contents). My answers will be entirely my own work.
                  </span>
                </label>

                <div className="flex items-center justify-end">
                  <Button
                    onClick={handleStart}
                    disabled={!agreed || !devicesReady || startMutation.isPending}
                    size="lg"
                  >
                    {startMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Start test
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TenantThemeProvider>
    </LayoutWrapper>
  );
}

/**
 * "Allow camera / microphone" step. Start stays disabled until it is green.
 */
function DeviceCheck({ devices }: { devices: ReturnType<typeof useDevicePrecheck> }) {
  const granted = devices.status === "granted";
  return (
    <div
      className={
        granted
          ? "rounded-md border border-green-600/40 bg-green-50 p-3 dark:bg-green-950/30"
          : "rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30"
      }
    >
      <div className="flex items-start gap-3">
        {granted ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        ) : devices.status === "denied" || devices.status === "unavailable" ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        ) : (
          <Camera className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="flex-1">
          <p className="text-foreground text-sm font-medium">
            {granted
              ? `Your ${devices.what} is ready.`
              : `This test needs your ${devices.what}. Allow access to continue.`}
          </p>
          {devices.message && (
            <p className="text-muted-foreground mt-1 text-sm">{devices.message}</p>
          )}
        </div>
        {!granted && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void devices.request()}
            disabled={devices.status === "checking"}
          >
            {devices.status === "checking" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {devices.status === "denied" || devices.status === "unavailable"
              ? "Try again"
              : "Allow access"}
          </Button>
        )}
      </div>
    </div>
  );
}

// Bluebook "Practice Test" info row: icon in a circle + heading + body text.
function PracticeTestInfo({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-foreground text-lg font-bold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

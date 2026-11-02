"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@open-mtlms/core";
import Link from "next/link";
import { ArrowRight, Check, Trophy, X } from "lucide-react";

import { type ChecklistItem } from "@/lib/api/onboarding";
import {
  useDismissChecklist,
  useOnboardingChecklist,
} from "@/lib/hooks/use-onboarding";

export function LaunchChecklist() {
  const { data, isLoading } = useOnboardingChecklist();
  const dismiss = useDismissChecklist();

  if (isLoading || !data) return null;
  if (data.is_dismissed && data.is_completed) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            {data.is_completed ? (
              <>
                <Trophy className="h-5 w-5 text-amber-500" /> Academy ready
              </>
            ) : (
              <>Launch your academy</>
            )}
          </CardTitle>
          <CardDescription>
            {data.is_completed
              ? "All set, celebrate, share, and start enrolling learners."
              : `${data.percent_done}% done · about ${Math.max(5, 25 - Math.round(data.percent_done / 4))} minutes left`}
          </CardDescription>
        </div>
        {data.is_completed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            aria-label="Dismiss checklist"
            className="rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ProgressBar percent={data.percent_done} />
        <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
          {data.items.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 py-3",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          item.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-card text-transparent",
        )}
        aria-hidden
      >
        {item.done && <Check className="h-3.5 w-3.5" />}
      </span>
      <span
        className={cn(
          "flex-1 text-sm font-medium",
          item.done
            ? "text-muted-foreground line-through"
            : "text-foreground",
        )}
      >
        {item.label}
      </span>
      {!item.done && (
        <Link
          href={item.action_url}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Start <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </li>
  );
}

"use client";

import { cn } from "@open-mtlms/core";
import {
  Info,
  LayoutDashboard,
  ListChecks,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import type { BatchTabKey } from "./batch-tabs";

interface Pill {
  key: BatchTabKey;
  label: string;
  icon: LucideIcon;
}

const PILLS: Pill[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "about", label: "About", icon: Info },
  { key: "content", label: "Content", icon: ListChecks },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
];

interface Props {
  slug: string;
  activeTab: BatchTabKey;
}

/**
 * Horizontal pill bar at the top of the batch detail page. Tab clicks are
 * wrapped in `useTransition` so the previous tab stays painted while the
 * next tab's data resolves, gives the URL change an "instant" feel even
 * when the new tab does its own React Query fetch on mount. We use
 * `router.replace` (not `push`) so the browser's back stack doesn't fill
 * up with one entry per tab switch, and `scroll: false` so the page
 * doesn't jump to the top on every click.
 */
export function BatchPillNav({ slug, activeTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (key: BatchTabKey) => {
    if (key === activeTab) return;
    const path = pathname ?? `/batches/${slug}`;
    startTransition(() => {
      router.replace(`${path}?tab=${key}`, { scroll: false });
    });
  };

  return (
    <div className="bg-background/80 sticky top-0 z-10 -mx-4 mb-6 overflow-x-auto border-b backdrop-blur sm:-mx-6 lg:-mx-8">
      <nav className="flex min-w-max items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
        {PILLS.map((p) => {
          const Icon = p.icon;
          const active = activeTab === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleSelect(p.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex flex-shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                // Subtle pulse on the active pill while a transition is in
                // flight, signals "we heard you" without a hard spinner.
                isPending && active && "opacity-80"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

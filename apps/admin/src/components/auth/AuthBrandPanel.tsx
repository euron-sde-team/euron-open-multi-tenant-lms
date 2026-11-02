"use client";

import { BarChart3, BookOpen, Sparkles, Users } from "lucide-react";
import { PLATFORM_LOGO_URL, PLATFORM_NAME } from "@/lib/brand";

const LOGO = PLATFORM_LOGO_URL;

function FeatureRow({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border py-3">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
        {icon}
      </span>
      <span className="text-sm text-foreground/80">{text}</span>
    </div>
  );
}

interface Props {
  /** Optional override for the panel headline (default: PLATFORM_NAME). */
  headline?: string;
  /** Optional override for the panel sub-copy. */
  subcopy?: string;
}

/**
 * The left "brand" panel shared by /login, /start (signup) and
 * /onboarding/quiz. A calm neutral surface with the emerald mark and a
 * short feature list set on hairlines.
 *
 * Hidden on mobile via `hidden lg:flex`.
 */
export function AuthBrandPanel({ headline, subcopy }: Props) {
  return (
    <div className="relative hidden border-r border-border bg-muted/40 lg:flex lg:flex-col lg:items-center lg:justify-center">
      <div className="flex w-full max-w-sm flex-col px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt={PLATFORM_NAME} className="h-12 w-12 object-contain" />

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
          {headline ?? PLATFORM_NAME}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {subcopy ??
            "Your all-in-one platform to manage, grow, and scale your digital education business."}
        </p>

        <div className="mt-10 w-full border-b border-border">
          <FeatureRow icon={<BookOpen className="h-4 w-4" />} text="Courses, Books & Content" />
          <FeatureRow icon={<Users className="h-4 w-4" />} text="Students & Team Management" />
          <FeatureRow
            icon={<BarChart3 className="h-4 w-4" />}
            text="Analytics & Revenue Insights"
          />
          <FeatureRow icon={<Sparkles className="h-4 w-4" />} text="AI-Powered Learning Tools" />
        </div>
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {PLATFORM_NAME}
      </p>
    </div>
  );
}

"use client";

import { Card, CardContent } from "@open-mtlms/core";
import type { ReactNode } from "react";

import {
  WizardStepIndicator,
  type WizardStageId,
} from "./WizardStepIndicator";

interface Props {
  /** Top-level stage indicator. Hidden for the celebratory reveal screen. */
  stage?: WizardStageId;
  /** Sub-progress bar (e.g. dots for quiz Q1..Q5). Rendered under the indicator. */
  subProgress?: ReactNode;
  children: ReactNode;
}

// Shared shell for every onboarding wizard step. Provides:
//   - subtle gradient background tied to tenant primary
//   - centred max-w-3xl container with consistent vertical rhythm
//   - 3-stage indicator at the top (About → Quiz → Live)
//   - optional sub-progress underneath
//   - elevated Card to host step content
//
// Borrowed from the rich onboarding-wizard layout pattern at
// `apps/admin/src/components/pages/onboarding-wizard/onboarding-wizard.tsx`.
export function WizardLayout({ stage, subProgress, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {stage && (
        <div className="space-y-3">
          <WizardStepIndicator current={stage} />
          {subProgress && (
            <div className="flex items-center justify-center">
              {subProgress}
            </div>
          )}
        </div>
      )}
      <Card className="rounded-3xl border border-border/60 shadow-xl shadow-black/[0.04] dark:shadow-black/30">
        <CardContent className="p-6 sm:p-10 md:p-12">{children}</CardContent>
      </Card>
    </div>
  );
}

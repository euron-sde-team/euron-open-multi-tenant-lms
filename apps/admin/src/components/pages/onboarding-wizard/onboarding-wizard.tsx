"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";

import { useTenantWebUrl } from "@/lib/hooks/use-tenant-domain-url";
import { cn } from "@/lib/utils";

import { LaunchProgress } from "./launch-progress";
import { LaunchSuccess } from "./launch-success";
import { StepBusinessInfo } from "./step-business-info";
import { StepTemplate } from "./step-template";
import { StepTheme } from "./step-theme";
import type { WizardStep } from "./types";
import { useOnboardingWizard } from "./use-onboarding-wizard";

interface OnboardingWizardProps {
  tenantId: string;
  tenantName: string;
  /** Called when user dismisses the wizard after success (or clicks "Go to Pages") */
  onComplete?: () => void;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "template", label: "Template" },
  { id: "theme", label: "Theme" },
  { id: "business-info", label: "Business Info" },
];

function StepIndicator({ steps, currentStep }: { steps: typeof STEPS; currentStep: WizardStep }) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isCompleted = i < currentIndex;

        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn("h-px w-8 sm:w-12", isCompleted ? "bg-primary" : "bg-border")}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingWizard({ tenantId, tenantName, onComplete }: OnboardingWizardProps) {
  const wizard = useOnboardingWizard(tenantId);
  const websiteUrl = useTenantWebUrl("");

  const isLaunching = wizard.launchPhase !== "idle" && wizard.launchPhase !== "done" && wizard.launchPhase !== "error";
  const isDone = wizard.launchPhase === "done";
  const isError = wizard.launchPhase === "error";

  // During launch: show progress
  if (isLaunching || isError) {
    return (
      <Card className="mx-auto max-w-4xl">
        <CardContent className="p-6">
          <LaunchProgress
            pageProgresses={wizard.pageProgresses}
            launchPhase={wizard.launchPhase}
            launchError={wizard.launchError}
          />
          {isError && (
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" onClick={() => { wizard.reset(); }}>
                Start Over
              </Button>
              <Button onClick={wizard.launch}>Retry</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // After success: show live URL
  if (isDone) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="p-6">
          <LaunchSuccess
            websiteUrl={websiteUrl}
            onGoToPages={() => {
              wizard.reset();
              onComplete?.();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // Normal wizard steps
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">Set Up Your Website</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your complete website in minutes{tenantName ? ` for ${tenantName}` : ""}.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={STEPS} currentStep={wizard.currentStep} />

      {/* Step content */}
      <Card>
        <CardContent className="p-6">
          {wizard.currentStep === "template" && (
            <StepTemplate
              selectedTemplateId={wizard.selectedHomepageTemplateId}
              onSelectTemplate={wizard.setSelectedHomepageTemplateId}
            />
          )}
          {wizard.currentStep === "theme" && (
            <StepTheme
              selectedThemePresetId={wizard.selectedThemePresetId}
              onSelectTheme={wizard.setSelectedThemePresetId}
            />
          )}
          {wizard.currentStep === "business-info" && (
            <StepBusinessInfo
              businessInfo={wizard.businessInfo}
              onBusinessInfoChange={wizard.setBusinessInfo}
              useAI={wizard.useAI}
              onToggleAI={wizard.setUseAI}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={wizard.goBack}
          disabled={wizard.currentStep === "template"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {wizard.currentStep === "business-info" ? (
          <Button onClick={wizard.launch} disabled={!wizard.canGoNext()}>
            <Rocket className="mr-2 h-4 w-4" />
            Launch My Website
          </Button>
        ) : (
          <Button onClick={wizard.goNext} disabled={!wizard.canGoNext()}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

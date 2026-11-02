"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  HowItWorksMindfulnessContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface HowItWorksMindfulnessSectionProps {
  section: SectionConfig;
}

export function HowItWorksMindfulnessSection({ section }: HowItWorksMindfulnessSectionProps) {
  const content = section.content as HowItWorksMindfulnessContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof HowItWorksMindfulnessContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);
  const steps = content.steps ?? [];

  return (
    <section className={cn("relative py-12 sm:py-16 md:py-20 lg:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        {/* Header */}
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-12 lg:mb-20">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0 sm:gap-x-3">
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              as="h2"
              className="text-3xl font-bold sm:text-4xl md:text-5xl lg:text-[3.75rem]"
            />
            {(content.headlineAccent || isEditMode) && (
              <EditableText
                value={content.headlineAccent ?? ""}
                onChange={(v) => handleContentUpdate("headlineAccent", v)}
                styleKey="headlineAccent"
                style={content.textStyles?.headlineAccent}
                onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                as="span"
                className="text-3xl font-bold text-primary sm:text-4xl md:text-5xl lg:text-[3.75rem]"
                placeholder="accent"
              />
            )}
          </div>
          {(content.description || isEditMode) && (
            <div className="mt-3 sm:mt-4">
              <EditableText
                value={content.description ?? ""}
                onChange={(v) => handleContentUpdate("description", v)}
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                as="p"
                className="mx-auto max-w-2xl text-base font-light text-muted-foreground sm:text-lg"
                placeholder="Add a description..."
              />
            </div>
          )}
        </div>

        {/* Step Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className="group rounded-2xl border p-6 text-center shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-xl sm:rounded-[2rem] sm:p-8 lg:p-10"
              style={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            >
              {/* Icon container */}
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg sm:mb-6 sm:h-16 sm:w-16 sm:rounded-2xl lg:mb-8 lg:h-20 lg:w-20 lg:rounded-3xl"
                style={{
                  background: "hsl(var(--primary))",
                  boxShadow: "0 8px 24px hsl(var(--primary) / 0.3)",
                }}
              >
                <StepIcon name={step.icon} />
              </div>

              {/* Step label */}
              <EditableText
                value={step.stepLabel}
                onChange={(v) => {
                  const newSteps = [...steps];
                  newSteps[i] = { ...newSteps[i], stepLabel: v };
                  handleContentUpdate("steps", newSteps);
                }}
                as="span"
                className="mb-2 block text-xs font-bold text-primary sm:mb-3 sm:text-sm"
              />

              {/* Title */}
              <EditableText
                value={step.title}
                onChange={(v) => {
                  const newSteps = [...steps];
                  newSteps[i] = { ...newSteps[i], title: v };
                  handleContentUpdate("steps", newSteps);
                }}
                as="h3"
                className="mb-2 text-lg font-bold sm:mb-3 sm:text-xl lg:text-2xl"
              />

              {/* Description */}
              <EditableText
                value={step.description}
                onChange={(v) => {
                  const newSteps = [...steps];
                  newSteps[i] = { ...newSteps[i], description: v };
                  handleContentUpdate("steps", newSteps);
                }}
                as="p"
                className="text-sm leading-relaxed text-muted-foreground sm:text-base"
                multiline
              />

              {isEditMode && steps.length > 1 && (
                <button
                  className="mt-4 text-xs text-muted-foreground/50 hover:text-destructive"
                  onClick={() => handleContentUpdate("steps", steps.filter((_, j) => j !== i))}
                >
                  Remove step
                </button>
              )}
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <button
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() =>
                handleContentUpdate("steps", [
                  ...steps,
                  { id: `step-${Date.now()}`, icon: "star", stepLabel: `STEP ${steps.length + 1}`, title: "New Step", description: "Description here." },
                ])
              }
            >
              + Add Step
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function StepIcon({ name }: { name: string }) {
  const s = "hsl(var(--primary-foreground))";
  const icons: Record<string, React.ReactNode> = {
    search: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" />
        <circle cx="11" cy="11" r="3" opacity="0.4" />
        <path d="M11 8v0" strokeWidth="2.5" opacity="0.5" />
      </svg>
    ),
    "shopping-cart": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
        <circle cx="9" cy="18" r="0.5" fill={s} opacity="0.4" />
        <circle cx="15" cy="18" r="0.5" fill={s} opacity="0.4" />
      </svg>
    ),
    "graduation-cap": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 9l10 6 10-6-10-6Z" fill={s} fillOpacity="0.1" />
        <path d="M2 9l10 6 10-6" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        <path d="M22 9v7" />
        <circle cx="22" cy="17" r="1" fill={s} opacity="0.5" />
      </svg>
    ),
    star: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" opacity="0.15" fill={s} />
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
        <path d="m12 8 1.85 3.76L18 12.27l-3 2.93.71 4.12L12 17.27l-3.71 2.05.71-4.12-3-2.93 4.15-.51L12 8Z" fill={s} fillOpacity="0.2" />
        <path d="m12 8 1.85 3.76L18 12.27l-3 2.93.71 4.12L12 17.27l-3.71 2.05.71-4.12-3-2.93 4.15-.51L12 8Z" />
      </svg>
    ),
    lotus: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20c-4-4-8-7-8-11a4 4 0 0 1 8 0 4 4 0 0 1 8 0c0 4-4 7-8 11Z" fill={s} fillOpacity="0.1" />
        <path d="M12 20c-4-4-8-7-8-11a4 4 0 0 1 8 0 4 4 0 0 1 8 0c0 4-4 7-8 11Z" />
        <path d="M12 10v6" opacity="0.4" />
      </svg>
    ),
    compass: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={s} fillOpacity="0.15" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" />
        <circle cx="12" cy="12" r="1.5" fill={s} opacity="0.4" />
      </svg>
    ),
  };

  return <>{icons[name] || icons.star}</>;
}

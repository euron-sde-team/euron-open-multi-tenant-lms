"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, SubscriptionComparisonContent } from "@open-mtlms/shared";
import { Check, X, Crown } from "lucide-react";

import { cn } from "../../../lib/utils";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionComparisonSectionProps {
  section: SectionConfig;
}

export function SubscriptionComparisonSection({ section }: SubscriptionComparisonSectionProps) {
  const content = section.content as SubscriptionComparisonContent;
  const { EditableText, isEditMode, updateSectionContent } = useSectionEditor();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof SubscriptionComparisonContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleRowUpdate = (index: number, key: string, value: unknown) => {
    const newRows = [...(content.rows || [])];
    newRows[index] = { ...newRows[index], [key]: value };
    handleContentUpdate("rows", newRows);
  };

  const paidLabel = (section.content as Record<string, unknown>)?.__subscriptionName as string | undefined
    || content.paidColumnLabel;

  function renderCellValue(value: string | boolean, isPaid = false) {
    if (typeof value === "boolean") {
      return value ? (
        <div className={cn(
          "mx-auto flex h-6 w-6 items-center justify-center rounded-full",
          isPaid ? "bg-primary/15 text-primary" : "bg-green-500/15 text-green-600 dark:text-green-400"
        )}>
          <Check className="h-3.5 w-3.5" />
        </div>
      ) : (
        <X className="mx-auto h-4 w-4 text-muted-foreground/60" />
      );
    }
    return <span className="text-xs font-medium sm:text-sm">{value}</span>;
  }

  return (
    <section
      className={cn(
        "px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          />
          {content.subheadline && (
            <div className="mt-3 sm:mt-4">
              <EditableText
                value={content.subheadline}
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
                as="p"
                className="text-base text-muted-foreground sm:text-lg"
              />
            </div>
          )}
        </div>

        {/* Comparison Table */}
        <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl border bg-card shadow-sm sm:mt-12">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_80px] items-center border-b bg-muted/50 sm:grid-cols-[1fr_120px_120px]">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6 sm:py-4 sm:text-sm">
              <EditableLabel value={content.featureColumnLabel} fallback="Feature" onChange={(v) => handleContentUpdate("featureColumnLabel", v)} />
            </div>
            <div className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground sm:px-4 sm:py-4 sm:text-sm">
              {isEditMode ? (
                <EditableText
                  value={content.freeColumnLabel}
                  onChange={(value) => handleContentUpdate("freeColumnLabel", value)}
                />
              ) : (
                content.freeColumnLabel
              )}
            </div>
            <div className="flex items-center justify-center gap-1 px-2 py-3 text-center text-xs font-bold text-primary sm:gap-1.5 sm:px-4 sm:py-4 sm:text-sm">
              <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {isEditMode ? (
                <EditableText
                  value={content.paidColumnLabel}
                  onChange={(value) => handleContentUpdate("paidColumnLabel", value)}
                />
              ) : (
                paidLabel
              )}
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y">
            {content.rows?.map((row, index) => (
              <div
                key={row.id || index}
                className="grid grid-cols-[1fr_80px_80px] items-center transition-colors hover:bg-muted/20 sm:grid-cols-[1fr_120px_120px]"
              >
                <div className="px-4 py-3 text-xs sm:px-6 sm:py-3.5 sm:text-sm">
                  {isEditMode ? (
                    <EditableText
                      value={row.feature}
                      onChange={(value) => handleRowUpdate(index, "feature", value)}
                    />
                  ) : (
                    row.feature
                  )}
                </div>
                <div className="px-2 py-3 text-center sm:px-4 sm:py-3.5">
                  {renderCellValue(row.freeValue)}
                </div>
                <div className="px-2 py-3 text-center sm:px-4 sm:py-3.5">
                  {renderCellValue(row.paidValue, true)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FeaturesSplitCorpupskillContent,
  FeaturesSplitColumn,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface FeaturesSplitCorpupskillSectionProps {
  section: SectionConfig;
}

const columnAccents = [
  {
    iconBg: "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--ring)))",
    checkBg: "hsl(var(--primary))",
    linkColor: "hsl(var(--primary))",
  },
  {
    iconBg: "linear-gradient(to bottom right, hsl(var(--ring)), hsl(var(--muted-foreground)))",
    checkBg: "hsl(var(--ring))",
    linkColor: "hsl(var(--ring))",
  },
];

export function FeaturesSplitCorpupskillSection({ section }: FeaturesSplitCorpupskillSectionProps) {
  const { isEditMode, EditableText, LinkComponent, updateSectionContent } = useSectionEditor();
  const content = section.content as FeaturesSplitCorpupskillContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const columns = content.columns ?? [];

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleColumnUpdate = (colIdx: number, updates: Partial<FeaturesSplitColumn>) => {
    const newCols = [...columns] as [FeaturesSplitColumn, FeaturesSplitColumn];
    newCols[colIdx] = { ...newCols[colIdx], ...updates };
    updateSectionContent(section.id, { columns: newCols });
  };

  const handleCheckItemUpdate = (colIdx: number, itemIdx: number, updates: Partial<{ title: string; description: string }>) => {
    const col = columns[colIdx];
    const newItems = [...col.checkItems];
    newItems[itemIdx] = { ...newItems[itemIdx], ...updates };
    handleColumnUpdate(colIdx, { checkItems: newItems });
  };

  const addCheckItem = (colIdx: number) => {
    const col = columns[colIdx];
    handleColumnUpdate(colIdx, {
      checkItems: [...col.checkItems, { id: `ci-${Date.now()}`, title: "New Item", description: "Description here" }],
    });
  };

  const removeCheckItem = (colIdx: number, itemIdx: number) => {
    const col = columns[colIdx];
    if (col.checkItems.length <= 1) return;
    handleColumnUpdate(colIdx, {
      checkItems: col.checkItems.filter((_: { id: string }, i: number) => i !== itemIdx),
    });
  };

  return (
    <section className={cn("relative", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-2">
          {columns.map((col, colIdx) => {
            const accent = columnAccents[colIdx % columnAccents.length];
            const iconName = (col.icon || "trending-up")
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join("") as keyof typeof LucideIcons;
            const IconComp = (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || LucideIcons.TrendingUp;

            return (
              <div
                key={colIdx}
                className={cn(
                  "p-8 sm:p-12 lg:p-16 xl:p-20",
                  colIdx === 0
                    ? "bg-muted/50 lg:border-r border-border"
                    : "bg-background"
                )}
              >
                <div className="mx-auto max-w-xl">
                  {/* Icon */}
                  <div
                    className="mb-6 flex h-14 w-14 items-center justify-center text-white sm:mb-8 sm:h-16 sm:w-16"
                    style={{ background: accent.iconBg }}
                  >
                    <IconComp className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>

                  {/* Headline */}
                  <h3 className="mb-4 text-2xl font-black sm:mb-6 sm:text-3xl lg:text-4xl xl:text-[2.75rem]">
                    <EditableText
                      value={col.headline}
                      onChange={(v) => handleColumnUpdate(colIdx, { headline: v })}
                      as="span"
                      styleKey={`col${colIdx}-headline`}
                      style={content.textStyles?.[`col${colIdx}-headline`]}
                      onStyleChange={(s) => handleTextStyleChange(`col${colIdx}-headline`, s)}
                    />
                  </h3>

                  {/* Description */}
                  {(col.description || isEditMode) && (
                    <p className="mb-8 text-base text-muted-foreground sm:mb-10 sm:text-lg lg:text-xl">
                      <EditableText
                        value={col.description || ""}
                        onChange={(v) => handleColumnUpdate(colIdx, { description: v })}
                        as="span"
                        placeholder="Add a description..."
                        multiline
                      />
                    </p>
                  )}

                  {/* Check items */}
                  <div className="mb-8 space-y-5 sm:mb-12 sm:space-y-6">
                    {col.checkItems.map((item, itemIdx) => (
                      <div key={item.id} className="relative flex items-start gap-4">
                        {isEditMode && col.checkItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCheckItem(colIdx, itemIdx)}
                            className="absolute -left-5 top-0 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <div
                          className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center text-white sm:h-8 sm:w-8"
                          style={{ background: accent.checkBg }}
                        >
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </div>
                        <div>
                          <div className="font-bold">
                            <EditableText
                              value={item.title}
                              onChange={(v) => handleCheckItemUpdate(colIdx, itemIdx, { title: v })}
                              as="span"
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <EditableText
                              value={item.description}
                              onChange={(v) => handleCheckItemUpdate(colIdx, itemIdx, { description: v })}
                              as="span"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => addCheckItem(colIdx)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" /> Add Item
                      </button>
                    )}
                  </div>

                  {/* Link */}
                  {(col.linkText || isEditMode) && (
                    <div className="inline-flex items-center gap-2 text-base font-bold sm:text-lg" style={{ color: accent.linkColor }}>
                      {isEditMode ? (
                        <EditableText
                          value={col.linkText || ""}
                          onChange={(v) => handleColumnUpdate(colIdx, { linkText: v })}
                          as="span"
                          placeholder="Link text..."
                        />
                      ) : col.linkHref ? (
                        <LinkComponent href={col.linkHref} className="inline-flex items-center gap-2">
                          {col.linkText}
                          <ArrowRight className="h-4 w-4" />
                        </LinkComponent>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {col.linkText}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                      {isEditMode && <ArrowRight className="h-4 w-4" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

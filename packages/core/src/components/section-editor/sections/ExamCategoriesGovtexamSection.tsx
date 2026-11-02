"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  ExamCategoriesGovtexamContent,
  ExamCategoryItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface ExamCategoriesGovtexamSectionProps {
  section: SectionConfig;
}

const cardAccents = [
  {
    bg: "linear-gradient(to bottom right, hsl(var(--destructive) / 0.06), hsl(var(--warning) / 0.06))",
    bgDark: "linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--card)))",
    border: "hsl(var(--destructive) / 0.15)",
    iconBg: "linear-gradient(to bottom right, hsl(var(--destructive)), hsl(var(--warning)))",
  },
  {
    bg: "linear-gradient(to bottom right, hsl(var(--primary) / 0.06), hsl(var(--ring) / 0.06))",
    bgDark: "linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--card)))",
    border: "hsl(var(--primary) / 0.15)",
    iconBg: "linear-gradient(to bottom right, hsl(var(--primary)), hsl(var(--ring)))",
  },
  {
    bg: "linear-gradient(to bottom right, hsl(var(--success) / 0.06), hsl(var(--success) / 0.04))",
    bgDark: "linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--card)))",
    border: "hsl(var(--success) / 0.15)",
    iconBg: "linear-gradient(to bottom right, hsl(var(--success)), hsl(var(--success)))",
  },
  {
    bg: "linear-gradient(to bottom right, hsl(var(--ring) / 0.06), hsl(var(--primary) / 0.04))",
    bgDark: "linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--card)))",
    border: "hsl(var(--ring) / 0.15)",
    iconBg: "linear-gradient(to bottom right, hsl(var(--ring)), hsl(var(--primary)))",
  },
];

export function ExamCategoriesGovtexamSection({ section }: ExamCategoriesGovtexamSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as ExamCategoriesGovtexamContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof ExamCategoriesGovtexamContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const categories = content.categories ?? [];

  const handleCategoryUpdate = (index: number, updates: Partial<ExamCategoryItem>) => {
    const newItems = [...categories];
    newItems[index] = { ...newItems[index], ...updates };
    handleContentUpdate("categories", newItems);
  };

  const addCategory = () => {
    handleContentUpdate("categories", [
      ...categories,
      { id: `cat-${Date.now()}`, icon: "file-text", title: "New Exam", description: "Exam description" },
    ]);
  };

  const removeCategory = (index: number) => {
    if (categories.length <= 1) return;
    handleContentUpdate("categories", categories.filter((_: ExamCategoryItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn("py-16 md:py-20", hasCustomBg ? "bg-transparent" : "bg-card")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl lg:text-[2.75rem]">
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
            {(content.headlineAccent || isEditMode) && (
              <>
                {" "}
                <span className="text-primary">
                  <EditableText
                    value={content.headlineAccent || ""}
                    onChange={(v) => handleContentUpdate("headlineAccent", v)}
                    as="span"
                    placeholder="Accent text..."
                  />
                </span>
              </>
            )}
          </h2>
          {(content.description || isEditMode) && (
            <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a description..."
              />
            </p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat, index) => {
            const accent = cardAccents[index % cardAccents.length];
            const iconName = cat.icon
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join("") as keyof typeof LucideIcons;
            const IconComp = (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || LucideIcons.FileText;

            return (
              <div
                key={cat.id}
                className="group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                style={{
                  background: accent.bg,
                  borderColor: accent.border,
                }}
              >
                {isEditMode && categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCategory(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                <div
                  className="absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-full"
                  style={{ background: "hsl(var(--primary) / 0.08)" }}
                />

                <div className="relative">
                  <div
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                    style={{ background: accent.iconBg }}
                  >
                    <IconComp className="h-6 w-6 text-white" />
                  </div>

                  <h3 className="mb-2 text-xl font-bold">
                    <EditableText
                      value={cat.title}
                      onChange={(v) => handleCategoryUpdate(index, { title: v })}
                      as="span"
                    />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <EditableText
                      value={cat.description}
                      onChange={(v) => handleCategoryUpdate(index, { description: v })}
                      as="span"
                    />
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              style={{ borderColor: "hsl(var(--border))" }}
              onClick={addCategory}
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

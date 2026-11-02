"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  TermsUsContentContent,
  TermsUsSection,
  TextStyle,
} from "@open-mtlms/shared";
import { FileText, Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

// Cycle through 3 color variants for the numbered badges
const badgeColors = [
  "bg-primary/10 text-primary",
  "bg-accent/10 text-accent-foreground",
  "bg-secondary/10 text-secondary-foreground",
];

interface TermsUsContentSectionProps {
  section: SectionConfig;
}

export function TermsUsContentSection({ section }: TermsUsContentSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as TermsUsContentContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const sections = content.sections ?? [];

  const handleContentUpdate = (key: keyof TermsUsContentContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleSectionUpdate = (index: number, updates: Partial<TermsUsSection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    handleContentUpdate("sections", newSections);
  };

  const addSection = () => {
    handleContentUpdate("sections", [
      ...sections,
      { id: `sec-${Date.now()}`, title: "New Section", body: "Add your terms content here..." },
    ]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    handleContentUpdate("sections", sections.filter((_, i) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-0 pb-14 md:pb-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-3xl px-5">
        {/* Intro banner */}
        {(content.introText || isEditMode) && (
          <div className="mb-5 rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.04] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[0.92rem] leading-relaxed text-muted-foreground">
                <EditableText
                  value={content.introText ?? ""}
                  onChange={(v) => handleContentUpdate("introText", v)}
                  styleKey="introText"
                  style={content.textStyles?.introText}
                  onStyleChange={(s) => handleTextStyleChange("introText", s)}
                  multiline
                 
                />
              </p>
            </div>
          </div>
        )}

        {/* Numbered sections */}
        <div className="flex flex-col gap-5">
          {sections.map((sec, i) => (
            <div
              key={sec.id}
              className="group/terms relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.04] sm:p-8"
            >
              {isEditMode && sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/terms:opacity-100"
                  title="Remove section"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Header with number badge */}
              <div className="mb-4 flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  badgeColors[i % badgeColors.length],
                )}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h2 className="text-xl font-bold sm:text-2xl">
                  <EditableText
                    value={sec.title}
                    onChange={(v) => handleSectionUpdate(i, { title: v })}
                    styleKey={`sec-${i}-title`}
                    style={content.textStyles?.[`sec-${i}-title`]}
                    onStyleChange={(s) => handleTextStyleChange(`sec-${i}-title`, s)}
                    as="span"
                   
                  />
                </h2>
              </div>

              {/* Body */}
              <div className="text-[0.92rem] leading-relaxed text-muted-foreground">
                <EditableText
                  value={sec.body}
                  onChange={(v) => handleSectionUpdate(i, { body: v })}
                  styleKey={`sec-${i}-body`}
                  style={content.textStyles?.[`sec-${i}-body`]}
                  onStyleChange={(s) => handleTextStyleChange(`sec-${i}-body`, s)}
                  multiline
                 
                />
              </div>
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addSection}>
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

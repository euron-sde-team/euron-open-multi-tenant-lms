"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, PrivacyPageContent, LegalSection } from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface PrivacyPageSectionProps { section: SectionConfig; }

export function PrivacyPageSection({ section }: PrivacyPageSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as PrivacyPageContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof PrivacyPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const sections = content?.sections ?? [];
  const isStandard = variant === "standard";
  const isMinimal = variant === "minimal";

  const handleSectionUpdate = (index: number, updates: Partial<LegalSection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    handleContentUpdate("sections", newSections);
  };

  const addSection = () => {
    const newSection: LegalSection = {
      id: `section-${Date.now()}`,
      title: "New Section",
      content: "Add your content here...",
    };
    handleContentUpdate("sections", [...sections, newSection]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    handleContentUpdate("sections", sections.filter((_, i) => i !== index));
  };

  const renderSection = (s: LegalSection, i: number) => (
    <div key={s.id} id={`privacy-${s.id}`} className="group/legal relative">
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-xl font-bold">
          {i + 1}.{" "}
          <EditableText
            value={s.title}
            onChange={(v) => handleSectionUpdate(i, { title: v })}
            as="span"
           
          />
        </h2>
        {isEditMode && sections.length > 1 && (
          <button
            type="button"
            onClick={() => removeSection(i)}
            className="mt-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/legal:opacity-100"
            title="Remove section"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 leading-relaxed text-muted-foreground">
        <EditableText
          value={s.content}
          onChange={(v) => handleSectionUpdate(i, { content: v })}
          as="p"
          multiline
         
        />
      </div>
    </div>
  );

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <EditableText value={content?.headline ?? "Privacy Policy"} onChange={(v) => handleContentUpdate("headline", v)} as="h1" className="text-4xl font-bold tracking-tight sm:text-5xl" />
          {(content?.subheadline || isEditMode) && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content?.subheadline ?? ""} onChange={(v) => handleContentUpdate("subheadline", v)} />
            </p>
          )}
          {(content?.lastUpdated || isEditMode) && (
            <p className="mt-2 text-sm text-muted-foreground">
              Last updated:{" "}
              <EditableText
                value={content?.lastUpdated ?? ""}
                onChange={(v) => handleContentUpdate("lastUpdated", v)}
                placeholder="Add date..."
              />
            </p>
          )}
        </div>

        {/* Content */}
        {isStandard ? (
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-4">
            <nav className="hidden lg:block">
              <div className="sticky top-24 space-y-1">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
                {sections.map((s, i) => (
                  <a key={s.id} href={`#privacy-${s.id}`} className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{i + 1}. {s.title}</a>
                ))}
              </div>
            </nav>
            <div className="space-y-10 lg:col-span-3">
              {sections.map((s, i) => renderSection(s, i))}
              {isEditMode && (
                <Button variant="outline" size="sm" onClick={addSection} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-10">
            {sections.map((s, i) => renderSection(s, i))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addSection} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            )}
          </div>
        )}

        {/* Contact */}
        {(!isMinimal && (content?.contactHeadline || isEditMode)) && (
          <div className="mx-auto mt-16 max-w-xl rounded-2xl bg-muted/50 p-8 text-center">
            <h3 className="text-xl font-bold">
              <EditableText
                value={content?.contactHeadline ?? ""}
                onChange={(v) => handleContentUpdate("contactHeadline", v)}
               
              />
            </h3>
            {(content?.contactText || isEditMode) && (
              <p className="mt-2 text-muted-foreground">
                <EditableText
                  value={content?.contactText ?? ""}
                  onChange={(v) => handleContentUpdate("contactText", v)}
                 
                />
              </p>
            )}
            {(content?.contactEmail || isEditMode) && (
              <div className="mt-3">
                {isEditMode ? (
                  <EditableText
                    value={content?.contactEmail ?? ""}
                    onChange={(v) => handleContentUpdate("contactEmail", v)}
                    as="span"
                    className="inline-block font-medium text-primary"
                    placeholder="email@example.com"
                  />
                ) : (
                  <a href={`mailto:${content?.contactEmail}`} className="inline-block font-medium text-primary hover:underline">{content?.contactEmail}</a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

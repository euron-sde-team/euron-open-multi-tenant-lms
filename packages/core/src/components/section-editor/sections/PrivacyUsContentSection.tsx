"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  PrivacyUsContentContent,
  PrivacyUsPolicySection,
  TextStyle,
} from "@open-mtlms/shared";
import {
  Archive,
  ClipboardCheck,
  Clock,
  FileText,
  Fingerprint,
  Heart,
  Lightbulb,
  Lock,
  PenLine,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  "clipboard-check": ClipboardCheck,
  archive: Archive,
  lightbulb: Lightbulb,
  lock: Lock,
  clock: Clock,
  fingerprint: Fingerprint,
  user: User,
  users: Users,
  heart: Heart,
  "pen-line": PenLine,
  shield: Shield,
  "file-text": FileText,
};

const iconOptions = Object.keys(iconMap);

interface PrivacyUsContentSectionProps {
  section: SectionConfig;
}

export function PrivacyUsContentSection({ section }: PrivacyUsContentSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as PrivacyUsContentContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const sections = content.sections ?? [];

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleSectionUpdate = (index: number, updates: Partial<PrivacyUsPolicySection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    updateSectionContent(section.id, { sections: newSections });
  };

  const addSection = () => {
    updateSectionContent(section.id, {
      sections: [
        ...sections,
        { id: `sec-${Date.now()}`, icon: "file-text", title: "New Section", body: "Add your policy content here..." },
      ],
    });
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    updateSectionContent(section.id, { sections: sections.filter((_, i) => i !== index) });
  };

  return (
    <section
      className={cn(
        "py-0 pb-14 md:pb-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-3xl px-5">
        <div className="flex flex-col gap-5">
          {sections.map((sec, i) => {
            const Icon = iconMap[sec.icon ?? "file-text"] ?? FileText;
            return (
              <div
                key={sec.id}
                className="group/policy relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.04] sm:p-8"
              >
                {isEditMode && sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSection(i)}
                    className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/policy:opacity-100"
                    title="Remove section"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
                    {isEditMode ? (
                      <select
                        value={sec.icon ?? "file-text"}
                        onChange={(e) => handleSectionUpdate(i, { icon: e.target.value })}
                        className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-xs"
                        title="Choose icon"
                      >
                        {iconOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Icon className="h-5 w-5 text-primary" />
                    )}
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
            );
          })}
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

"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutUsValuesContent,
  AboutUsValueItem,
  TextStyle,
} from "@open-mtlms/shared";
import {
  CheckCircle,
  Globe,
  Heart,
  Shield,
  Star,
  Target,
  Users,
  Zap,
  Plus,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, LucideIcon> = {
  globe: Globe,
  "check-circle": CheckCircle,
  zap: Zap,
  users: Users,
  heart: Heart,
  shield: Shield,
  star: Star,
  target: Target,
};

const iconOptions = Object.keys(iconMap);

interface AboutUsValuesSectionProps {
  section: SectionConfig;
}

export function AboutUsValuesSection({ section }: AboutUsValuesSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutUsValuesContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const values = content.values ?? [];

  const handleContentUpdate = (key: keyof AboutUsValuesContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleValueUpdate = (index: number, updates: Partial<AboutUsValueItem>) => {
    const newValues = [...values];
    newValues[index] = { ...newValues[index], ...updates };
    handleContentUpdate("values", newValues);
  };

  const addValue = () => {
    const newValue: AboutUsValueItem = {
      id: `value-${Date.now()}`,
      icon: "heart",
      title: "New Value",
      description: "Describe this value...",
    };
    handleContentUpdate("values", [...values, newValue]);
  };

  const removeValue = (index: number) => {
    if (values.length <= 1) return;
    handleContentUpdate("values", values.filter((_, i) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-20",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="container-custom">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.08]">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            as="h2"
            className="text-[clamp(1.625rem,4vw,2.25rem)] font-bold"
          />
          {(content.description || isEditMode) && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              <EditableText
                value={content.description ?? ""}
                onChange={(v) => handleContentUpdate("description", v)}
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                multiline
               
              />
            </p>
          )}
        </div>

        {/* Values grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((val, i) => {
            const Icon = iconMap[val.icon ?? "heart"] ?? Heart;
            return (
              <div
                key={val.id}
                className="group/vcard relative rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                {isEditMode && values.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeValue(i)}
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/vcard:opacity-100"
                    title="Remove value"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Icon */}
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/[0.08]">
                  {isEditMode ? (
                    <select
                      value={val.icon ?? "heart"}
                      onChange={(e) => handleValueUpdate(i, { icon: e.target.value })}
                      className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-xs"
                      title="Choose icon"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Icon className="h-[18px] w-[18px] text-primary" />
                  )}
                </div>

                {/* Title */}
                <h3 className="mb-1.5 text-[15px] font-bold">
                  <EditableText
                    value={val.title}
                    onChange={(v) => handleValueUpdate(i, { title: v })}
                    styleKey={`value-${i}-title`}
                    style={content.textStyles?.[`value-${i}-title`]}
                    onStyleChange={(s) => handleTextStyleChange(`value-${i}-title`, s)}
                   
                  />
                </h3>

                {/* Description */}
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  <EditableText
                    value={val.description}
                    onChange={(v) => handleValueUpdate(i, { description: v })}
                    styleKey={`value-${i}-desc`}
                    style={content.textStyles?.[`value-${i}-desc`]}
                    onStyleChange={(s) => handleTextStyleChange(`value-${i}-desc`, s)}
                    multiline
                   
                  />
                </p>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addValue}>
              <Plus className="mr-2 h-4 w-4" />
              Add Value
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

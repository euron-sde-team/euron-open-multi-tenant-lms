"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutUsOfferingsContent,
  AboutUsOfferingItem,
  TextStyle,
} from "@open-mtlms/shared";
import {
  BookOpen,
  Briefcase,
  Code,
  Globe,
  Heart,
  Layers,
  Shield,
  Star,
  Target,
  Users,
  Zap,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, LucideIcon> = {
  code: Code,
  "book-open": BookOpen,
  briefcase: Briefcase,
  globe: Globe,
  heart: Heart,
  layers: Layers,
  shield: Shield,
  star: Star,
  target: Target,
  users: Users,
  zap: Zap,
};

const iconOptions = Object.keys(iconMap);

interface AboutUsOfferingsSectionProps {
  section: SectionConfig;
}

export function AboutUsOfferingsSection({ section }: AboutUsOfferingsSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutUsOfferingsContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const offerings = content.offerings ?? [];

  const handleContentUpdate = (key: keyof AboutUsOfferingsContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleOfferingUpdate = (index: number, updates: Partial<AboutUsOfferingItem>) => {
    const newOfferings = [...offerings];
    newOfferings[index] = { ...newOfferings[index], ...updates };
    handleContentUpdate("offerings", newOfferings);
  };

  const addOffering = () => {
    const newOffering: AboutUsOfferingItem = {
      id: `offering-${Date.now()}`,
      icon: "star",
      title: "New Offering",
      description: "Describe what you offer...",
      tags: ["Tag 1"],
    };
    handleContentUpdate("offerings", [...offerings, newOffering]);
  };

  const removeOffering = (index: number) => {
    if (offerings.length <= 1) return;
    handleContentUpdate("offerings", offerings.filter((_, i) => i !== index));
  };

  const addTag = (offeringIndex: number) => {
    const offering = offerings[offeringIndex];
    const tags = [...(offering.tags ?? []), "New Tag"];
    handleOfferingUpdate(offeringIndex, { tags });
  };

  const removeTag = (offeringIndex: number, tagIndex: number) => {
    const offering = offerings[offeringIndex];
    const tags = (offering.tags ?? []).filter((_, i) => i !== tagIndex);
    handleOfferingUpdate(offeringIndex, { tags });
  };

  const updateTag = (offeringIndex: number, tagIndex: number, value: string) => {
    const offering = offerings[offeringIndex];
    const tags = [...(offering.tags ?? [])];
    tags[tagIndex] = value;
    handleOfferingUpdate(offeringIndex, { tags });
  };

  return (
    <section
      className={cn(
        "py-16 md:py-20",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="container-custom">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.08]">
            <Layers className="h-5 w-5 text-primary" />
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

        {/* Cards grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {offerings.map((offering, i) => {
            const Icon = iconMap[offering.icon ?? "star"] ?? Star;
            return (
              <div
                key={offering.id}
                className="group/card relative rounded-2xl border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                {isEditMode && offerings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOffering(i)}
                    className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
                    title="Remove offering"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Icon */}
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/[0.08]">
                  {isEditMode ? (
                    <select
                      value={offering.icon ?? "star"}
                      onChange={(e) => handleOfferingUpdate(i, { icon: e.target.value })}
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

                {/* Title */}
                <h3 className="mb-2 text-lg font-bold">
                  <EditableText
                    value={offering.title}
                    onChange={(v) => handleOfferingUpdate(i, { title: v })}
                    styleKey={`offering-${i}-title`}
                    style={content.textStyles?.[`offering-${i}-title`]}
                    onStyleChange={(s) => handleTextStyleChange(`offering-${i}-title`, s)}
                   
                  />
                </h3>

                {/* Description */}
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  <EditableText
                    value={offering.description}
                    onChange={(v) => handleOfferingUpdate(i, { description: v })}
                    styleKey={`offering-${i}-desc`}
                    style={content.textStyles?.[`offering-${i}-desc`]}
                    onStyleChange={(s) => handleTextStyleChange(`offering-${i}-desc`, s)}
                    multiline
                   
                  />
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {(offering.tags ?? []).map((tag, ti) => (
                    <span
                      key={ti}
                      className="group/tag relative inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                    >
                      {isEditMode ? (
                        <>
                          <EditableText
                            value={tag}
                            onChange={(v) => updateTag(i, ti, v)}
                            as="span"
                            placeholder="Tag"
                          />
                          <button
                            type="button"
                            onClick={() => removeTag(i, ti)}
                            className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/tag:opacity-100"
                            title="Remove tag"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </>
                      ) : (
                        tag
                      )}
                    </span>
                  ))}
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => addTag(i)}
                      className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      title="Add tag"
                    >
                      <Plus className="mr-1 h-2.5 w-2.5" />
                      Tag
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addOffering}>
              <Plus className="mr-2 h-4 w-4" />
              Add Offering
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FeaturesExamprepContent,
  FeaturesExamprepItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  Mic,
  Monitor,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  presentation: Monitor,
  "file-text": FileText,
  mic: Mic,
  "book-open": BookOpen,
  "bar-chart": BarChart3,
  video: Video,
};

const cardAccents = [
  { bg: "hsl(var(--primary) / 0.06)", iconBg: "hsl(var(--primary) / 0.12)", iconColor: "hsl(var(--primary))" },
  { bg: "hsl(var(--ring) / 0.06)", iconBg: "hsl(var(--ring) / 0.12)", iconColor: "hsl(var(--ring))" },
  { bg: "hsl(var(--ring) / 0.04)", iconBg: "hsl(var(--ring) / 0.10)", iconColor: "hsl(var(--ring))" },
  { bg: "hsl(var(--success) / 0.06)", iconBg: "hsl(var(--success) / 0.12)", iconColor: "hsl(var(--success))" },
  { bg: "hsl(var(--warning) / 0.06)", iconBg: "hsl(var(--warning) / 0.12)", iconColor: "hsl(var(--warning))" },
  { bg: "hsl(var(--destructive) / 0.04)", iconBg: "hsl(var(--destructive) / 0.10)", iconColor: "hsl(var(--destructive))" },
];

interface FeaturesExamprepSectionProps {
  section: SectionConfig;
}

export function FeaturesExamprepSection({ section }: FeaturesExamprepSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FeaturesExamprepContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof FeaturesExamprepContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const features = content.features ?? [];

  const handleFeatureUpdate = (index: number, updates: Partial<FeaturesExamprepItem>) => {
    const newFeatures = [...features];
    newFeatures[index] = { ...newFeatures[index], ...updates };
    handleContentUpdate("features", newFeatures);
  };

  const addFeature = () => {
    handleContentUpdate("features", [
      ...features,
      { id: `feat-${Date.now()}`, icon: "video", title: "New Feature", description: "Feature description" },
    ]);
  };

  const removeFeature = (index: number) => {
    if (features.length <= 1) return;
    handleContentUpdate("features", features.filter((_: FeaturesExamprepItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold">
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
            <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a description..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}
        </div>

        {/* Feature grid */}
        <div className="grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {features.map((feature, index) => {
            const IconComp = iconMap[feature.icon || "video"] || Video;
            const accent = cardAccents[index % cardAccents.length];
            return (
              <div
                key={feature.id}
                className="group relative rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${accent.bg}, hsl(var(--card)))`,
                  borderColor: "hsl(var(--border))",
                }}
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div
                  className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: accent.iconBg }}
                >
                  <span style={{ color: accent.iconColor }}>
                    <IconComp className="h-6 w-6" />
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-bold">
                  <EditableText
                    value={feature.title}
                    onChange={(v) => handleFeatureUpdate(index, { title: v })}
                    as="span"
                  />
                </h3>
                <p className="mb-4 text-muted-foreground">
                  <EditableText
                    value={feature.description}
                    onChange={(v) => handleFeatureUpdate(index, { description: v })}
                    as="span"
                    multiline
                  />
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all group-hover:gap-2">
                  Learn More <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addFeature}>
              <Plus className="mr-1 h-4 w-4" /> Add Feature
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

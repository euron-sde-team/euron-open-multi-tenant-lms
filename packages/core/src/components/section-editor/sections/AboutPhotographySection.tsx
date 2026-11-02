"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  AboutPhotographyContent,
  AboutPhotographyCredential,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Award, GraduationCap, Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  "graduation-cap": GraduationCap,
};

interface AboutPhotographySectionProps {
  section: SectionConfig;
}

export function AboutPhotographySection({ section }: AboutPhotographySectionProps) {
  const { isEditMode, EditableText, EditableMedia, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutPhotographyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const credentials = content.credentials ?? [];

  const handleCredentialUpdate = (index: number, updates: Partial<AboutPhotographyCredential>) => {
    const newCreds = [...credentials];
    newCreds[index] = { ...newCreds[index], ...updates };
    handleContentUpdate("credentials", newCreds);
  };

  const addCredential = () => {
    handleContentUpdate("credentials", [
      ...credentials,
      { id: `cred-${Date.now()}`, icon: "award", title: "New Credential", description: "Description here" },
    ]);
  };

  const removeCredential = (index: number) => {
    handleContentUpdate("credentials", credentials.filter((_: AboutPhotographyCredential, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Image */}
          <div
            className="relative h-[300px] overflow-hidden sm:h-[400px] lg:h-[600px]"
            style={{
              border: "3px solid hsl(var(--foreground))",
              boxShadow: "4px 4px 0px 0px hsl(var(--foreground))",
              backgroundColor: "hsl(var(--muted))",
            }}
          >
            {isEditMode ? (
              <EditableMedia
                image={content.image}
                imageAlt={content.imageAlt || "About image"}
                onImageChange={(src, alt) => {
                  handleContentUpdate("image", src);
                  handleContentUpdate("imageAlt", alt);
                }}
                onVideoChange={() => {}}
                className="h-full w-full"
                aspectRatio="auto"
                sectionContext={{
                  sectionType: section.type,
                  headline: content.headline,
                  description: content.description,
                }}
              />
            ) : content.image ? (
              <img
                src={content.image}
                alt={content.imageAlt || "About image"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Text content */}
          <div className="space-y-8">
            <h2
              className="text-[clamp(2.5rem,5vw,4rem)] font-black uppercase tracking-tighter leading-[0.95]"
              style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
            >
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
                  <br />
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

            <div className="space-y-6">
              <p className="text-base font-medium leading-relaxed sm:text-xl">
                <EditableText
                  value={content.description || ""}
                  onChange={(v) => handleContentUpdate("description", v)}
                  as="span"
                  placeholder="Add description..."
                  styleKey="description"
                  style={content.textStyles?.description}
                  onStyleChange={(s) => handleTextStyleChange("description", s)}
                />
              </p>
              {(content.secondaryDescription || isEditMode) && (
                <p className="text-lg leading-relaxed text-muted-foreground">
                  <EditableText
                    value={content.secondaryDescription || ""}
                    onChange={(v) => handleContentUpdate("secondaryDescription", v)}
                    as="span"
                    placeholder="Add secondary description..."
                  />
                </p>
              )}
            </div>

            {/* Credential cards */}
            <div className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 sm:gap-6 sm:pt-8">
              {credentials.map((cred, index) => {
                const IconComp = iconMap[cred.icon || "award"] || Award;
                return (
                  <div
                    key={cred.id}
                    className="relative p-4 sm:p-6"
                    style={{
                      border: "3px solid hsl(var(--foreground))",
                      boxShadow: "4px 4px 0px 0px hsl(var(--foreground))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                  >
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => removeCredential(index)}
                        className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    <IconComp className="mb-3 h-7 w-7 text-primary sm:mb-4 sm:h-8 sm:w-8" />
                    <h4 className="text-lg font-bold text-primary sm:text-2xl">
                      <EditableText
                        value={cred.title}
                        onChange={(v) => handleCredentialUpdate(index, { title: v })}
                        as="span"
                      />
                    </h4>
                    <p className="mt-1 text-sm">
                      <EditableText
                        value={cred.description}
                        onChange={(v) => handleCredentialUpdate(index, { description: v })}
                        as="span"
                      />
                    </p>
                  </div>
                );
              })}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addCredential}>
                <Plus className="mr-1 h-4 w-4" /> Add Credential
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

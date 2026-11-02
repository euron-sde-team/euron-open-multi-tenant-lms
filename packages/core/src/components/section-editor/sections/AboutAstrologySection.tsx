"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  AboutAstrologyContent,
  AboutAstrologyCredential,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Moon, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  moon: Moon,
};

/* ── Zodiac wheel SVG, rendered directly, no background container ── */
function AstrologyPlaceholder() {
  const symbols = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
  return (
    <svg className="mx-auto w-full max-w-sm animate-[spin_180s_linear_infinite] sm:max-w-md" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="200" cy="200" r="195" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />
      <circle cx="200" cy="200" r="190" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.3" opacity="0.2" />
      {/* Middle ring */}
      <circle cx="200" cy="200" r="155" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.6" opacity="0.12" />
      {/* Inner ring */}
      <circle cx="200" cy="200" r="110" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.4" opacity="0.1" />
      {/* Innermost dashed */}
      <circle cx="200" cy="200" r="80" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.4" strokeDasharray="4 6" opacity="0.2" />

      {/* 12 house lines */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        return <line key={`d-${i}`} x1={200 + 110 * Math.cos(angle)} y1={200 + 110 * Math.sin(angle)} x2={200 + 195 * Math.cos(angle)} y2={200 + 195 * Math.sin(angle)} stroke="hsl(var(--primary))" strokeWidth="0.4" opacity="0.15" />;
      })}

      {/* Zodiac symbols */}
      {symbols.map((sym, i) => {
        const angle = (i * 30 + 15 - 90) * (Math.PI / 180);
        return <text key={`s-${i}`} x={200 + 172 * Math.cos(angle)} y={200 + 172 * Math.sin(angle)} textAnchor="middle" dominantBaseline="central" fill="hsl(var(--primary))" fontSize="20" opacity="0.75">{sym}</text>;
      })}

      {/* House numbers */}
      {["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"].map((n, i) => {
        const angle = (i * 30 + 15 - 90) * (Math.PI / 180);
        return <text key={`n-${i}`} x={200 + 132 * Math.cos(angle)} y={200 + 132 * Math.sin(angle)} textAnchor="middle" dominantBaseline="central" fill="hsl(var(--foreground))" fontSize="10" opacity="0.25" fontFamily="serif">{n}</text>;
      })}

      {/* Center sun */}
      <circle cx="200" cy="200" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.3" />
      <circle cx="200" cy="200" r="8" fill="hsl(var(--primary))" opacity="0.15" />
      <circle cx="200" cy="200" r="3" fill="hsl(var(--primary))" opacity="0.4" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 45) * (Math.PI / 180);
        return <line key={`r-${i}`} x1={200 + 14 * Math.cos(a)} y1={200 + 14 * Math.sin(a)} x2={200 + 26 * Math.cos(a)} y2={200 + 26 * Math.sin(a)} stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.25" strokeLinecap="round" />;
      })}

      {/* Cardinal dots */}
      {[0,90,180,270].map((deg, i) => {
        const a = (deg - 90) * (Math.PI / 180);
        return <circle key={`c-${i}`} cx={200 + 198 * Math.cos(a)} cy={200 + 198 * Math.sin(a)} r="2.5" fill="hsl(var(--primary))" opacity="0.5" />;
      })}
    </svg>
  );
}

/* ── Image with fallback to placeholder on error ── */
function AboutImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AstrologyPlaceholder />;
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

interface AboutAstrologySectionProps {
  section: SectionConfig;
}

export function AboutAstrologySection({ section }: AboutAstrologySectionProps) {
  const { isEditMode, EditableText, EditableMedia, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutAstrologyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutAstrologyContent, value: unknown) => {
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

  const handleCredentialUpdate = (index: number, updates: Partial<AboutAstrologyCredential>) => {
    const newCreds = [...credentials];
    newCreds[index] = { ...newCreds[index], ...updates };
    handleContentUpdate("credentials", newCreds);
  };

  const addCredential = () => {
    handleContentUpdate("credentials", [
      ...credentials,
      { id: `cred-${Date.now()}`, icon: "star", title: "New Credential", description: "Description here" },
    ]);
  };

  const removeCredential = (index: number) => {
    handleContentUpdate("credentials", credentials.filter((_: AboutAstrologyCredential, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "relative py-12 sm:py-14 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left: Image or Zodiac SVG */}
          <div className="flex items-center justify-center">
            {isEditMode ? (
              <div className="w-full max-w-[420px] overflow-hidden rounded-2xl" style={{ aspectRatio: "4/5", border: "1px solid hsl(var(--border))" }}>
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
              </div>
            ) : content.image ? (
              <div className="w-full max-w-[420px] overflow-hidden rounded-2xl" style={{ aspectRatio: "4/5" }}>
                <AboutImage src={content.image} alt={content.imageAlt || "About image"} />
              </div>
            ) : (
              <AstrologyPlaceholder />
            )}
          </div>

          {/* Right: Text content */}
          <div className="space-y-6 sm:space-y-8">
            <h2
              className="text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight"
              style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
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
                  <span style={{ color: "hsl(var(--primary))" }}>
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

            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">
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
                <p className="text-sm leading-relaxed text-muted-foreground">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {credentials.map((cred, index) => {
                const IconComp = iconMap[cred.icon || "star"] || Star;
                return (
                  <div
                    key={cred.id}
                    className="group relative flex items-start gap-3.5 rounded-xl p-4 transition-all hover:shadow-md"
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => removeCredential(index)}
                        className="absolute right-1.5 top-1.5 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "hsl(var(--primary) / 0.1)" }}
                    >
                      <IconComp className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold">
                        <EditableText
                          value={cred.title}
                          onChange={(v) => handleCredentialUpdate(index, { title: v })}
                          as="span"
                        />
                      </h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        <EditableText
                          value={cred.description}
                          onChange={(v) => handleCredentialUpdate(index, { description: v })}
                          as="span"
                        />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addCredential} className="rounded-full">
                <Plus className="mr-1 h-4 w-4" /> Add Credential
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

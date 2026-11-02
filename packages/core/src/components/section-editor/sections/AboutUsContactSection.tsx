"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutUsContactContent,
  TextStyle,
} from "@open-mtlms/shared";
import { Mail } from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface AboutUsContactSectionProps {
  section: SectionConfig;
}

export function AboutUsContactSection({ section }: AboutUsContactSectionProps) {
  const { isEditMode, EditableText, LinkComponent, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutUsContactContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutUsContactContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  return (
    <section
      className={cn(
        "py-16 md:py-20",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="container-custom">
        <div className="relative overflow-hidden rounded-3xl bg-foreground p-10 md:grid md:grid-cols-[1.2fr_0.8fr] md:items-center md:gap-10 md:p-14">
          {/* Decorative gradient */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-[250px] w-[250px] rounded-full bg-primary/[0.08] blur-2xl" />

          {/* Text content */}
          <div className="relative">
            {/* Label */}
            {(content.label || isEditMode) && (
              <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Mail className="h-3.5 w-3.5" />
                <EditableText
                  value={content.label ?? ""}
                  onChange={(v) => handleContentUpdate("label", v)}
                  as="span"
                 
                />
              </div>
            )}

            {/* Headline */}
            <h2 className="mb-3 text-[clamp(1.5rem,3.5vw,2rem)] font-bold leading-snug text-background">
              <EditableText
                value={content.headline}
                onChange={(v) => handleContentUpdate("headline", v)}
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
               
              />
            </h2>

            {/* Description */}
            <p className="mb-7 text-sm leading-relaxed text-background/60">
              <EditableText
                value={content.description}
                onChange={(v) => handleContentUpdate("description", v)}
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                multiline
               
              />
            </p>

            {/* Email row */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-background/[0.12]">
                <Mail className="h-[18px] w-[18px] text-background/70" />
              </div>
              <div>
                {(content.emailLabel || isEditMode) && (
                  <span className="block text-xs font-medium text-background/50">
                    <EditableText
                      value={content.emailLabel ?? ""}
                      onChange={(v) => handleContentUpdate("emailLabel", v)}
                      as="span"
                      placeholder="Email label..."
                    />
                  </span>
                )}
                {isEditMode ? (
                  <span className="text-base font-semibold text-background">
                    <EditableText
                      value={content.email}
                      onChange={(v) => handleContentUpdate("email", v)}
                      as="span"
                      placeholder="email@example.com"
                    />
                  </span>
                ) : (
                  <LinkComponent
                    href={`mailto:${content.email}`}
                    className="text-base font-semibold text-background transition-colors hover:text-primary"
                  >
                    {content.email}
                  </LinkComponent>
                )}
              </div>
            </div>
          </div>

          {/* Visual side, decorative SVG envelope */}
          <div className="relative z-[1] hidden justify-center md:flex">
            <svg
              width="200"
              height="160"
              viewBox="0 0 200 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-80"
            >
              <rect x="20" y="40" width="160" height="100" rx="12" className="fill-muted/20" />
              <path d="M20 52 L100 100 L180 52" className="stroke-primary" strokeWidth="2" opacity="0.35" />
              <path d="M20 140 L70 98" className="stroke-primary" strokeWidth="1.5" opacity="0.15" />
              <path d="M180 140 L130 98" className="stroke-primary" strokeWidth="1.5" opacity="0.15" />
              <rect x="50" y="22" width="100" height="65" rx="6" className="fill-foreground stroke-primary" strokeWidth="1" opacity="0.5" />
              <rect x="64" y="38" width="48" height="4" rx="2" className="fill-primary" opacity="0.5" />
              <rect x="64" y="48" width="72" height="3" rx="1.5" className="fill-background" opacity="0.12" />
              <rect x="64" y="56" width="56" height="3" rx="1.5" className="fill-background" opacity="0.08" />
              <rect x="64" y="64" width="40" height="3" rx="1.5" className="fill-background" opacity="0.08" />
              <circle cx="162" cy="38" r="9" className="fill-primary" />
              <text x="162" y="42" textAnchor="middle" className="fill-primary-foreground" fontSize="10" fontWeight="bold">1</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

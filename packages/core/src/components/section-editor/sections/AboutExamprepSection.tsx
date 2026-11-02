"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  AboutExamprepContent,
  AboutExamprepCredential,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Check, Plus, Trash2, Users } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface AboutExamprepSectionProps {
  section: SectionConfig;
}

export function AboutExamprepSection({ section }: AboutExamprepSectionProps) {
  const { isEditMode, EditableText, EditableMedia, LinkComponent, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutExamprepContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutExamprepContent, value: unknown) => {
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

  const handleCredentialUpdate = (index: number, updates: Partial<AboutExamprepCredential>) => {
    const newCreds = [...credentials];
    newCreds[index] = { ...newCreds[index], ...updates };
    handleContentUpdate("credentials", newCreds);
  };

  const addCredential = () => {
    handleContentUpdate("credentials", [
      ...credentials,
      { id: `cred-${Date.now()}`, icon: "check", title: "New Credential", description: "Description here" },
    ]);
  };

  const removeCredential = (index: number) => {
    if (credentials.length <= 1) return;
    handleContentUpdate("credentials", credentials.filter((_: AboutExamprepCredential, i: number) => i !== index));
  };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-2">
          {/* Image */}
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto max-w-md sm:max-w-lg lg:max-w-none">
              <div
                className="absolute -inset-4 rounded-2xl blur-2xl"
                style={{ background: "hsl(var(--primary) / 0.12)" }}
              />
              <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                <EditableMedia
                  image={content.image}
                  imageAlt={content.imageAlt || "About image"}
                  onImageChange={(src, alt) => {
                    handleContentUpdate("image", src);
                    handleContentUpdate("imageAlt", alt);
                  }}
                  onVideoChange={() => {}}
                  className="aspect-[4/3] w-full object-cover"
                  aspectRatio="video"
                  placeholder="Click to add faculty image"
                  recommendedAspectRatio="4:3"
                  sectionContext={{
                    sectionType: section.type,
                    headline: content.headline,
                    description: content.description,
                    badge: content.badge,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            {/* Badge */}
            {(content.badge || isEditMode) && (
              <div className="flex justify-center lg:justify-start">
                <div
                  className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: "hsl(var(--primary) / 0.1)" }}
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    <EditableText
                      value={content.badge || ""}
                      onChange={(v) => handleContentUpdate("badge", v)}
                      as="span"
                      placeholder="Badge text..."
                    />
                  </span>
                </div>
              </div>
            )}

            {/* Headline */}
            <h2 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl md:text-4xl">
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

            {/* Description */}
            {(content.description || isEditMode) && (
              <p className="mx-auto mb-6 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0 lg:max-w-none">
                <EditableText
                  value={content.description || ""}
                  onChange={(v) => handleContentUpdate("description", v)}
                  as="span"
                  placeholder="Add a description..."
                  styleKey="description"
                  style={content.textStyles?.description}
                  onStyleChange={(s) => handleTextStyleChange("description", s)}
                  multiline
                />
              </p>
            )}

            {/* Credentials */}
            <div className="mx-auto mb-8 max-w-md space-y-4 text-left lg:mx-0 lg:max-w-none">
              {credentials.map((cred, index) => (
                <div key={cred.id} className="relative flex items-start">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => removeCredential(index)}
                      className="absolute -left-6 top-0 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <div
                    className="mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "hsl(var(--success) / 0.1)" }}
                  >
                    <Check className="h-5 w-5" style={{ color: "hsl(var(--success))" }} />
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      <EditableText
                        value={cred.title}
                        onChange={(v) => handleCredentialUpdate(index, { title: v })}
                        as="span"
                      />
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      <EditableText
                        value={cred.description}
                        onChange={(v) => handleCredentialUpdate(index, { description: v })}
                        as="span"
                      />
                    </p>
                  </div>
                </div>
              ))}
              {isEditMode && (
                <div className="flex justify-center lg:justify-start">
                  <Button variant="outline" size="sm" onClick={addCredential}>
                    <Plus className="mr-1 h-4 w-4" /> Add Credential
                  </Button>
                </div>
              )}
            </div>

            {/* CTA */}
            {content.primaryCta && !content.primaryCta.hidden && (
              <div className="flex justify-center lg:justify-start">
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) =>
                  handleContentUpdate("primaryCta", { ...content.primaryCta, href })
                }
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) =>
                  handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })
                }
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button
                  type="button"
                  className="rounded-lg px-8 py-4 text-base font-semibold transition-all hover:scale-105"
                  style={{
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.primaryCta.text}
                      onChange={(v) =>
                        handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })
                      }
                      as="span"
                    />
                  ) : content.primaryCta.href.startsWith("#") ? (
                    <span onClick={() => handleCtaClick(content.primaryCta!.href)}>
                      {content.primaryCta.text}
                    </span>
                  ) : (
                    <LinkComponent href={content.primaryCta.href}>
                      {content.primaryCta.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

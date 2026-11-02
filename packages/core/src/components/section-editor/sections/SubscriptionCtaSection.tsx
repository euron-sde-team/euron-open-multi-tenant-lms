"use client";

import type { SectionConfig, SubscriptionCtaContent } from "@open-mtlms/shared";
import { ArrowRight } from "lucide-react";

import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionCtaSectionProps {
  section: SectionConfig;
}

export function SubscriptionCtaSection({ section }: SubscriptionCtaSectionProps) {
  const content = section.content as SubscriptionCtaContent;
  const { EditableText, LinkComponent, isEditMode, updateSectionContent } = useSectionEditor();

  const handleContentUpdate = (key: keyof SubscriptionCtaContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          />
          {content.subheadline && (
            <div className="mt-4 sm:mt-5">
              <EditableText
                value={content.subheadline}
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
                as="p"
                className="text-base leading-relaxed text-primary-foreground/80 sm:text-lg"
              />
            </div>
          )}

          {content.primaryCta && !content.primaryCta.hidden && (
            <div className="mt-8">
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
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-2 text-sm font-semibold shadow-lg sm:text-base"
                  asChild={!isEditMode}
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.primaryCta.text}
                      onChange={(value) =>
                        handleContentUpdate("primaryCta", { ...content.primaryCta, text: value })
                      }
                    />
                  ) : (
                    <LinkComponent href={content.primaryCta.href}>
                      {content.primaryCta.text}
                      <ArrowRight className="h-4 w-4" />
                    </LinkComponent>
                  )}
                </Button>
              </EditableClickable>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, SubscriptionFaqContent } from "@open-mtlms/shared";
import { HelpCircle } from "lucide-react";

import { cn } from "../../../lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionFaqSectionProps {
  section: SectionConfig;
}

export function SubscriptionFaqSection({ section }: SubscriptionFaqSectionProps) {
  const content = section.content as SubscriptionFaqContent;
  const { EditableText, updateSectionContent } = useSectionEditor();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof SubscriptionFaqContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleItemUpdate = (index: number, key: string, value: string) => {
    const newItems = [...(content.items || [])];
    newItems[index] = { ...newItems[index], [key]: value };
    handleContentUpdate("items", newItems);
  };

  return (
    <section
      className={cn(
        "px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8",
        hasCustomBg ? "bg-transparent" : "bg-muted/20",
      )}
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:text-sm">
            <HelpCircle className="h-3.5 w-3.5" />
            <EditableLabel value={content.badgeLabel} fallback="FAQ" onChange={(v) => handleContentUpdate("badgeLabel", v)} />
          </div>
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          />
          {content.subheadline && (
            <div className="mt-3 sm:mt-4">
              <EditableText
                value={content.subheadline}
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
                as="p"
                className="text-base text-muted-foreground sm:text-lg"
              />
            </div>
          )}
        </div>

        {/* FAQ Accordion */}
        <div className="mx-auto mt-10 max-w-3xl sm:mt-12">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {content.items?.map((item, index) => (
              <AccordionItem
                key={item.id || index}
                value={item.id || `item-${index}`}
                className="rounded-xl border bg-card px-5 shadow-sm transition-shadow data-[state=open]:shadow-md sm:px-6"
              >
                <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline sm:text-base [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0">
                  <EditableText
                    value={item.question}
                    onChange={(value) => handleItemUpdate(index, "question", value)}
                    styleKey={`faq-${index}-question`}
                    className="flex-1 pr-2"
                  />
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  <EditableText
                    value={item.answer}
                    onChange={(value) => handleItemUpdate(index, "answer", value)}
                    styleKey={`faq-${index}-answer`}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

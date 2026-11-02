"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { FAQContent, SectionConfig } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { useSectionEditor } from "../SectionEditorContext";

interface FAQAccordionSectionProps {
  section: SectionConfig;
}

export function FAQAccordionSection({ section }: FAQAccordionSectionProps) {
  const content = section.content as FAQContent;
  const { EditableText, updateSectionContent } = useSectionEditor();

  const handleContentUpdate = (key: keyof FAQContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleItemUpdate = (index: number, key: string, value: string) => {
    const newItems = [...(content.items || [])];
    newItems[index] = { ...newItems[index], [key]: value };
    handleContentUpdate("items", newItems);
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="container-custom">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          />
          {content.subheadline && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText
                value={content.subheadline}
                onChange={(value) =>
                  handleContentUpdate("subheadline", value)
                }
                styleKey="subheadline"
              />
            </p>
          )}
        </div>

        {/* FAQ Accordion */}
        <div className="mx-auto mt-12 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {content.items?.map((item, index) => (
              <AccordionItem
                key={item.id || index}
                value={item.id || `item-${index}`}
              >
                <AccordionTrigger className="text-left">
                  <EditableText
                    value={item.question}
                    onChange={(value) =>
                      handleItemUpdate(index, "question", value)
                    }
                    styleKey={`faq-${index}-question`}
                    className="flex-1"
                  />
                </AccordionTrigger>
                <AccordionContent>
                  <EditableText
                    value={item.answer}
                    onChange={(value) =>
                      handleItemUpdate(index, "answer", value)
                    }
                    styleKey={`faq-${index}-answer`}
                    className="text-muted-foreground"
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

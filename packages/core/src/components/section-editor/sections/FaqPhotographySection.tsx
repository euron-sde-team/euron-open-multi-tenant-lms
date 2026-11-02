"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FaqPhotographyContent,
  FaqPhotographyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface FaqPhotographySectionProps {
  section: SectionConfig;
}

export function FaqPhotographySection({ section }: FaqPhotographySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FaqPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleContentUpdate = (key: keyof FaqPhotographyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const items = content.items ?? [];

  const toggleFaq = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemUpdate = (index: number, updates: Partial<FaqPhotographyItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    handleContentUpdate("items", updated);
  };

  const addItem = () => {
    handleContentUpdate("items", [
      ...items,
      { id: `faq-${Date.now()}`, question: "New question?", answer: "Answer here..." },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    handleContentUpdate("items", items.filter((_: FaqPhotographyItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-16 text-center">
          <h2
            className="text-[clamp(2.5rem,5vw,4rem)] font-black uppercase tracking-tighter"
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
          </h2>
        </div>

        {/* FAQ items */}
        <div className="space-y-6">
          {items.map((item, index) => {
            const isOpen = expandedIds.has(item.id) || (expandedIds.size === 0 && index === 0);
            return (
              <div
                key={item.id}
                className="relative"
                style={{
                  border: "3px solid hsl(var(--foreground))",
                  boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                  backgroundColor: "hsl(var(--card))",
                }}
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleFaq(item.id)}
                  className="flex w-full items-center justify-between p-5 text-left sm:p-8"
                >
                  <h3 className="pr-4 text-lg font-bold sm:text-2xl">
                    <EditableText
                      value={item.question}
                      onChange={(v) => handleItemUpdate(index, { question: v })}
                      as="span"
                    />
                  </h3>
                  <ChevronDown
                    className={cn(
                      "h-6 w-6 shrink-0 transition-transform duration-200",
                      !isOpen && "-rotate-90",
                    )}
                  />
                </button>
                {isOpen && (
                  <div
                    className="border-t-[3px] px-5 pb-5 pt-3 sm:px-8 sm:pb-8 sm:pt-4"
                    style={{ borderColor: "hsl(var(--foreground))" }}
                  >
                    <p className="text-lg leading-relaxed text-muted-foreground">
                      <EditableText
                        value={item.answer}
                        onChange={(v) => handleItemUpdate(index, { answer: v })}
                        as="span"
                        multiline
                      />
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Add FAQ
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

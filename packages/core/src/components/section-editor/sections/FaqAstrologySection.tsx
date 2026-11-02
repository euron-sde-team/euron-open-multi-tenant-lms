"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FaqAstrologyContent,
  FaqAstrologyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ChevronDown, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface FaqAstrologySectionProps {
  section: SectionConfig;
}

export function FaqAstrologySection({ section }: FaqAstrologySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FaqAstrologyContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleContentUpdate = (key: keyof FaqAstrologyContent, value: unknown) => {
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

  const handleItemUpdate = (index: number, updates: Partial<FaqAstrologyItem>) => {
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
    handleContentUpdate("items", items.filter((_: FaqAstrologyItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "relative py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute right-0 top-1/3 h-56 w-56 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-0 h-40 w-40 rounded-full opacity-[0.025]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-8 text-center sm:mb-10">
          <h2
            className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold tracking-tight"
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
          </h2>
        </div>

        {/* FAQ items */}
        <div className="space-y-4">
          {items.map((item, index) => {
            const isOpen = expandedIds.has(item.id) || (expandedIds.size === 0 && index === 0);
            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl transition-all duration-300"
                style={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--primary) / 0.1)",
                  boxShadow: isOpen ? "0 4px 24px hsl(var(--primary) / 0.07)" : "0 2px 8px hsl(var(--primary) / 0.02)",
                  backdropFilter: "blur(8px)",
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
                  className="flex w-full items-center gap-4 p-5 text-left sm:p-6"
                >
                  {/* Star bullet */}
                  <Star
                    className="h-4 w-4 shrink-0"
                    style={{
                      color: isOpen ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      fill: isOpen ? "hsl(var(--primary) / 0.3)" : "transparent",
                    }}
                  />
                  <h3
                    className="flex-1 pr-2 text-base font-semibold sm:text-lg"
                    style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                  >
                    <EditableText
                      value={item.question}
                      onChange={(v) => handleItemUpdate(index, { question: v })}
                      as="span"
                    />
                  </h3>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200"
                    style={{ backgroundColor: isOpen ? "hsl(var(--primary) / 0.1)" : "transparent" }}
                  >
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 transition-transform duration-300",
                        isOpen ? "rotate-180 text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                </button>

                {/* Answer with smooth visual */}
                <div
                  className={cn(
                    "grid transition-all duration-300",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div
                      className="border-t px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4"
                      style={{ borderColor: "hsl(var(--primary) / 0.08)", marginLeft: "2.25rem" }}
                    >
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                        <EditableText
                          value={item.answer}
                          onChange={(v) => handleItemUpdate(index, { answer: v })}
                          as="span"
                          multiline
                        />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addItem} className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Add FAQ
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

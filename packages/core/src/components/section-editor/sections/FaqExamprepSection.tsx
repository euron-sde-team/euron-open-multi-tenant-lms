"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  FaqExamprepContent,
  FaqExamprepItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface FaqExamprepSectionProps {
  section: SectionConfig;
}

export function FaqExamprepSection({ section }: FaqExamprepSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FaqExamprepContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleContentUpdate = (key: keyof FaqExamprepContent, value: unknown) => {
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

  const handleItemUpdate = (index: number, updates: Partial<FaqExamprepItem>) => {
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
    handleContentUpdate("items", items.filter((_: FaqExamprepItem, i: number) => i !== index));
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
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl lg:text-[2.75rem]">
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
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a description..."
              />
            </p>
          )}
        </div>

        {/* FAQ items */}
        <div className="space-y-4">
          {items.map((item, index) => {
            const isOpen = expandedIds.has(item.id) || (expandedIds.size === 0 && index === 0);
            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleFaq(item.id)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors"
                  style={{ background: isOpen ? "hsl(var(--muted) / 0.5)" : "hsl(var(--card))" }}
                >
                  <h3 className="pr-4 font-semibold">
                    <EditableText
                      value={item.question}
                      onChange={(v) => handleItemUpdate(index, { question: v })}
                      as="span"
                    />
                  </h3>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-primary transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen && (
                  <div
                    className="px-6 pb-5"
                    style={{ background: "hsl(var(--muted) / 0.3)" }}
                  >
                    <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
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

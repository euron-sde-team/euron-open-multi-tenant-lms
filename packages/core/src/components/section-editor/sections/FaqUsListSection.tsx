"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  FaqUsListContent,
  FaqUsItem,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface FaqUsListSectionProps {
  section: SectionConfig;
}

export function FaqUsListSection({ section }: FaqUsListSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FaqUsListContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const items = content.items ?? [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleItemUpdate = (index: number, updates: Partial<FaqUsItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    updateSectionContent(section.id, { items: newItems });
  };

  const addItem = () => {
    updateSectionContent(section.id, {
      items: [
        ...items,
        { id: `faq-${Date.now()}`, question: "New question?", answer: "Add your answer here..." },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    updateSectionContent(section.id, { items: items.filter((_, i) => i !== index) });
  };

  return (
    <section
      className={cn(
        "py-0 pb-14 md:pb-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-[820px] px-5">
        <div className="flex flex-col gap-2.5">
          {items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={item.id}
                className={cn(
                  "group/faq relative overflow-hidden rounded-2xl border bg-card transition-all",
                  isOpen ? "border-primary/20 shadow-sm" : "hover:border-border/80 hover:shadow-sm",
                )}
              >
                {isEditMode && items.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                    className="absolute right-3 top-3 z-10 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/faq:opacity-100"
                    title="Remove FAQ"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Question row */}
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 px-6 py-5 transition-colors",
                    isOpen ? "bg-primary/[0.02]" : "hover:bg-muted/30",
                  )}
                  onClick={() => !isEditMode && setOpenIndex(isOpen ? null : i)}
                >
                  <span className={cn(
                    "text-[15px] font-medium leading-snug transition-colors",
                    isOpen && "text-primary",
                  )}>
                    <EditableText
                      value={item.question}
                      onChange={(v) => handleItemUpdate(i, { question: v })}
                      as="span"
                     
                    />
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[9px] text-lg font-light transition-all",
                      isOpen
                        ? "rotate-45 bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    +
                  </span>
                </div>

                {/* Answer (shown when open or in edit mode) */}
                {(isOpen || isEditMode) && (
                  <div className={cn(
                    "border-t px-6 pb-5 pt-4",
                    !isOpen && isEditMode && "opacity-50",
                  )}>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <EditableText
                        value={item.answer}
                        onChange={(v) => handleItemUpdate(i, { answer: v })}
                        styleKey={`answer-${i}`}
                        style={content.textStyles?.[`answer-${i}`]}
                        onStyleChange={(s) => handleTextStyleChange(`answer-${i}`, s)}
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
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add FAQ
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

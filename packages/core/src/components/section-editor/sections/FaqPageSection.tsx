"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, FAQPageContent, FAQPageItem, FAQPageCategory } from "@open-mtlms/shared";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface FaqPageSectionProps { section: SectionConfig; }

export function FaqPageSection({ section }: FaqPageSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as FAQPageContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleContentUpdate = (key: keyof FAQPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const items = content?.items ?? [];
  const categories = content?.categories ?? [];
  const isCategorized = variant === "categorized" && categories.length > 0;
  const isMinimal = variant === "minimal";

  // FAQ item CRUD
  const handleItemUpdate = (index: number, updates: Partial<FAQPageItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    handleContentUpdate("items", newItems);
  };

  const addItem = () => {
    const newItem: FAQPageItem = {
      id: `faq-${Date.now()}`,
      question: "New question?",
      answer: "Add your answer here...",
      ...(activeCategory ? { category: activeCategory } : {}),
    };
    handleContentUpdate("items", [...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    handleContentUpdate("items", items.filter((_, i) => i !== index));
  };

  // Category CRUD
  const handleCategoryUpdate = (index: number, updates: Partial<FAQPageCategory>) => {
    const newCats = [...categories];
    newCats[index] = { ...newCats[index], ...updates };
    handleContentUpdate("categories", newCats);
  };

  const addCategory = () => {
    const newCat: FAQPageCategory = {
      id: `cat-${Date.now()}`,
      name: "New Category",
    };
    handleContentUpdate("categories", [...categories, newCat]);
  };

  const removeCategory = (index: number) => {
    if (categories.length <= 1) return;
    handleContentUpdate("categories", categories.filter((_, i) => i !== index));
  };

  const filteredItems = isCategorized && activeCategory
    ? items.filter((i) => i.category === activeCategory)
    : items;

  const renderAccordion = (faqItems: typeof items) => (
    <div className="space-y-3">
      {faqItems.map((item) => {
        const itemIndex = items.findIndex((i) => i.id === item.id);
        const isOpen = openItem === item.id || isEditMode;

        return (
          <div key={item.id} className="group/faq rounded-lg border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-between p-4 text-left font-medium"
                onClick={() => !isEditMode && setOpenItem(openItem === item.id ? null : item.id)}
              >
                <span className="flex-1">
                  <EditableText
                    value={item.question}
                    onChange={(v) => handleItemUpdate(itemIndex, { question: v })}
                    as="span"
                    placeholder="Enter question..."
                  />
                </span>
                {!isEditMode && (
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                )}
              </button>
              {isEditMode && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(itemIndex)}
                  className="mr-3 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/faq:opacity-100"
                  title="Remove FAQ item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isOpen && (
              <div className="border-t px-4 pb-4 pt-2 text-sm leading-relaxed text-muted-foreground">
                <EditableText
                  value={item.answer}
                  onChange={(v) => handleItemUpdate(itemIndex, { answer: v })}
                  as="p"
                  multiline
                  placeholder="Enter answer..."
                />
              </div>
            )}
          </div>
        );
      })}
      {isEditMode && (
        <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
          <Plus className="mr-2 h-4 w-4" />
          Add FAQ Item
        </Button>
      )}
    </div>
  );

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <EditableText value={content?.headline ?? "FAQ"} onChange={(v) => handleContentUpdate("headline", v)} as="h1" className="text-4xl font-bold tracking-tight sm:text-5xl" />
          {(content?.subheadline || isEditMode) && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content?.subheadline ?? ""} onChange={(v) => handleContentUpdate("subheadline", v)} />
            </p>
          )}
        </div>

        {/* Category tabs */}
        {isCategorized && (
          <div className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-2">
            <button type="button" className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", !activeCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")} onClick={() => setActiveCategory(null)}>All</button>
            {categories.map((cat, catIndex) => (
              <div key={cat.id} className="group/cat relative flex items-center">
                {isEditMode ? (
                  <div className={cn("flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium", activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <EditableText
                      value={cat.name}
                      onChange={(v) => handleCategoryUpdate(catIndex, { name: v })}
                      as="span"
                     
                    />
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCategory(catIndex)}
                        className="ml-1 shrink-0 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-destructive/20 group-hover/cat:opacity-100"
                        title="Remove category"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button type="button" className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")} onClick={() => setActiveCategory(cat.id)}>{cat.name}</button>
                )}
              </div>
            ))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addCategory} className="rounded-full">
                <Plus className="mr-1 h-3 w-3" />
                Category
              </Button>
            )}
          </div>
        )}

        {/* FAQ items */}
        <div className="mx-auto max-w-3xl">
          {isCategorized && !activeCategory ? (
            categories.map((cat) => {
              const catItems = items.filter((i) => i.category === cat.id);
              if (catItems.length === 0 && !isEditMode) return null;
              return (
                <div key={cat.id} className="mb-8">
                  <h3 className="mb-4 text-lg font-semibold">{cat.name}</h3>
                  {renderAccordion(catItems.length > 0 ? catItems : [])}
                </div>
              );
            })
          ) : (
            renderAccordion(filteredItems)
          )}
        </div>

        {/* Contact block */}
        {(!isMinimal && (content?.contactHeadline || isEditMode)) && (
          <div className="mx-auto mt-16 max-w-xl rounded-2xl bg-muted/50 p-8 text-center">
            <h3 className="text-xl font-bold">
              <EditableText
                value={content?.contactHeadline ?? ""}
                onChange={(v) => handleContentUpdate("contactHeadline", v)}
                placeholder="Still have questions?"
              />
            </h3>
            {(content?.contactText || isEditMode) && (
              <p className="mt-2 text-muted-foreground">
                <EditableText
                  value={content?.contactText ?? ""}
                  onChange={(v) => handleContentUpdate("contactText", v)}
                  placeholder="Our team is here to help."
                />
              </p>
            )}
            {(content?.contactLinkText || isEditMode) && (
              <div className="mt-4">
                {isEditMode ? (
                  <div className="inline-flex flex-col items-center gap-1">
                    <EditableText
                      value={content?.contactLinkText ?? ""}
                      onChange={(v) => handleContentUpdate("contactLinkText", v)}
                      as="span"
                      className="font-medium text-primary"
                     
                    />
                    <EditableText
                      value={content?.contactLinkHref ?? ""}
                      onChange={(v) => handleContentUpdate("contactLinkHref", v)}
                      as="span"
                      className="text-xs text-muted-foreground"
                      placeholder="Link URL (e.g. /contact)"
                    />
                  </div>
                ) : (
                  <a href={content?.contactLinkHref ?? "/contact"} className="inline-block font-medium text-primary hover:underline">
                    {content?.contactLinkText} &rarr;
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

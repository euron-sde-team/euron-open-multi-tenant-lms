"use client";

import type {
  TrustedByGovtexamContent,
  TrustedByItem,
  SectionConfig,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";

import { useSectionEditor } from "../SectionEditorContext";
import { CorpupskillBrandLogo } from "./corpupskill-brand-logos";

interface TrustedByCorpupskillSectionProps {
  section: SectionConfig;
}

/** HTML: py-16 bg-gray-900 dark:bg-black, always a dark strip; light/dark only deepens the black */
export function TrustedByCorpupskillSection({ section }: TrustedByCorpupskillSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as TrustedByGovtexamContent;
  const items = content.items ?? [];

  const handleContentUpdate = (key: keyof TrustedByGovtexamContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleItemUpdate = (index: number, updates: Partial<TrustedByItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    handleContentUpdate("items", newItems);
  };

  const addItem = () => {
    handleContentUpdate("items", [
      ...items,
      { id: `tb-${Date.now()}`, icon: "brand-microsoft", name: "Microsoft" },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    handleContentUpdate("items", items.filter((_: TrustedByItem, i: number) => i !== index));
  };

  return (
    <section className="bg-neutral-900 py-12 text-white dark:bg-black sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          {(content.label || isEditMode) && (
            <div className="shrink-0 text-center text-sm font-bold uppercase tracking-widest text-white md:text-left">
              <EditableText
                value={content.label || ""}
                onChange={(v) => handleContentUpdate("label", v)}
                as="span"
                placeholder="Trusted by label..."
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 transition-opacity duration-300 hover:opacity-100 sm:gap-12 md:justify-end">
            {items.map((item, index) => (
                <div key={item.id} className="relative flex items-center gap-2 text-white">
                  {isEditMode && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute right-1 top-3 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                  <CorpupskillBrandLogo brandKey={item.icon} title={item.name} />
                  {isEditMode && (
                    <span className="max-w-[100px] text-xs text-neutral-300">
                      <EditableText
                        value={item.name}
                        onChange={(v) => handleItemUpdate(index, { name: v })}
                        as="span"
                      />
                    </span>
                  )}
                </div>
            ))}
          </div>
        </div>

        {isEditMode && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-white/30 px-5 py-2 text-xs font-medium text-white/70 transition-colors hover:border-white/50 hover:text-white"
              onClick={addItem}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import type {
  TrustedByGovtexamContent,
  TrustedByItem,
  SectionConfig,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useSectionEditor } from "../SectionEditorContext";

interface TrustedByGovtexamSectionProps {
  section: SectionConfig;
}

export function TrustedByGovtexamSection({ section }: TrustedByGovtexamSectionProps) {
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
      { id: `tb-${Date.now()}`, icon: "building", name: "New" },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    handleContentUpdate("items", items.filter((_: TrustedByItem, i: number) => i !== index));
  };

  function LogoItem({ item, index }: { item: TrustedByItem; index: number }) {
    const iconName = item.icon
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("") as keyof typeof LucideIcons;
    const IconComp = (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || LucideIcons.Building;

    return (
      <div className="relative flex flex-shrink-0 items-center gap-3 transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
        {isEditMode && items.length > 1 && (
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="absolute right-1 top-3 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
        <IconComp className="h-7 w-7 sm:h-8 sm:w-8" />
        <span className="text-lg font-bold sm:text-xl">
          <EditableText
            value={item.name}
            onChange={(v) => handleItemUpdate(index, { name: v })}
            as="span"
          />
        </span>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden border-y py-10 sm:py-12"
      style={{
        background: "hsl(var(--foreground))",
        borderColor: "hsl(var(--foreground) / 0.8)",
        color: "hsl(var(--background))",
      }}
    >
      {(content.label || isEditMode) && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
          <p
            className="text-center text-xs font-semibold uppercase tracking-wider sm:text-sm"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <EditableText
              value={content.label || ""}
              onChange={(v) => handleContentUpdate("label", v)}
              as="span"
              placeholder="Trusted by aspirants from..."
            />
          </p>
        </div>
      )}

      {isEditMode ? (
        <>
          <div className="govtexam-trusted-scrollbar flex gap-10 overflow-x-auto px-8 pb-4 sm:gap-16">
            {items.map((item, i) => (
              <LogoItem key={item.id} item={item} index={i} />
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-5 py-2 text-xs font-medium transition-colors"
              style={{ borderColor: "hsl(var(--muted-foreground) / 0.3)", color: "hsl(var(--muted-foreground))" }}
              onClick={addItem}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>
        </>
      ) : (
        <div className="govtexam-trusted-marquee-container relative">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24"
            style={{ background: `linear-gradient(to right, hsl(var(--foreground)), transparent)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24"
            style={{ background: `linear-gradient(to left, hsl(var(--foreground)), transparent)` }}
          />
          <div className="govtexam-trusted-marquee-track flex w-max items-center gap-10 py-4 sm:gap-16">
            {[...items, ...items].map((item, i) => (
              <LogoItem key={`${item.id}-${i}`} item={item} index={i % items.length} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .govtexam-trusted-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .govtexam-trusted-scrollbar::-webkit-scrollbar { display: none; }

        @keyframes govtexam-trusted-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .govtexam-trusted-marquee-track {
          animation: govtexam-trusted-scroll 20s linear infinite;
        }
        .govtexam-trusted-marquee-container:hover .govtexam-trusted-marquee-track {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

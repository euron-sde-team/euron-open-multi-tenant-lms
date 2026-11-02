"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  GalleryPhotographyContent,
  GalleryPhotographyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface GalleryPhotographySectionProps {
  section: SectionConfig;
}

export function GalleryPhotographySection({ section }: GalleryPhotographySectionProps) {
  const { isEditMode, EditableText, EditableImage, updateSectionContent } = useSectionEditor();
  const content = section.content as GalleryPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof GalleryPhotographyContent, value: unknown) => {
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

  const handleItemImageChange = (index: number, src: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], image: src };
    handleContentUpdate("items", updated);
  };

  const addItem = () => {
    handleContentUpdate("items", [
      ...items,
      { id: `gallery-${Date.now()}`, image: "", alt: "New photo" },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    handleContentUpdate("items", items.filter((_: GalleryPhotographyItem, i: number) => i !== index));
  };

  return (
    <section
      id="gallery-photography"
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-muted",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
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
          {(content.description || isEditMode) && (
            <p className="mx-auto mt-4 max-w-3xl text-xl text-muted-foreground">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add description..."
              />
            </p>
          )}
        </div>

        {/* Gallery grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="group relative h-40 overflow-hidden transition-all hover:-translate-y-1 sm:h-64"
              style={{
                border: "3px solid hsl(var(--foreground))",
                boxShadow: "4px 4px 0px 0px hsl(var(--foreground))",
              }}
            >
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              {isEditMode ? (
                <EditableImage
                  src={item.image}
                  alt={item.alt}
                  onChange={(src) => handleItemImageChange(index, src)}
                  className="h-full w-full"
                  aspectRatio="auto"
                />
              ) : item.image ? (
                <img
                  src={item.image}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  No image
                </div>
              )}
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Add Image
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

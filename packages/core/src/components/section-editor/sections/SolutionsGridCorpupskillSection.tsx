"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SolutionsGridCorpupskillContent,
  SolutionCard,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Star, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface SolutionsGridCorpupskillSectionProps {
  section: SectionConfig;
}

export function SolutionsGridCorpupskillSection({ section }: SolutionsGridCorpupskillSectionProps) {
  const { isEditMode, EditableText, EditableMedia, updateSectionContent } = useSectionEditor();
  const content = section.content as SolutionsGridCorpupskillContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const cards = content.cards ?? [];

  const handleContentUpdate = (key: keyof SolutionsGridCorpupskillContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleCardUpdate = (index: number, updates: Partial<SolutionCard>) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], ...updates };
    handleContentUpdate("cards", newCards);
  };

  const addCard = () => {
    handleContentUpdate("cards", [
      ...cards,
      {
        id: `card-${Date.now()}`,
        image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=300&fit=crop",
        badge: "Category",
        title: "New Program",
        rating: "4.8",
      },
    ]);
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) return;
    handleContentUpdate("cards", cards.filter((_: SolutionCard, i: number) => i !== index));
  };

  const cardBgColors = [
    "hsl(var(--foreground))",
    "hsl(var(--primary))",
    "hsl(var(--muted-foreground))",
    "hsl(var(--ring))",
    "hsl(var(--foreground) / 0.8)",
  ];

  return (
    <section
      className={cn("py-20 sm:py-24 md:py-32", hasCustomBg ? "bg-transparent" : "bg-background")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        {/* Header */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          {(content.badge || isEditMode) && (
            <div className="mb-6 sm:mb-8">
              <div
                className="inline-block px-4 py-2 text-xs font-bold uppercase tracking-wider"
                style={{
                  background: "hsl(var(--foreground))",
                  color: "hsl(var(--background))",
                }}
              >
                <EditableText
                  value={content.badge || ""}
                  onChange={(v) => handleContentUpdate("badge", v)}
                  as="span"
                  placeholder="Badge text..."
                />
              </div>
            </div>
          )}
          <h2 className="mb-4 max-w-3xl text-3xl font-black sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
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
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a description..."
                multiline
              />
            </p>
          )}
        </div>

        {/* Masonry grid */}
        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const isTall = index === 0;
            const bgColor = cardBgColors[index % cardBgColors.length];

            return (
              <div
                key={card.id}
                className={cn(
                  "group relative cursor-pointer",
                  isTall && "md:row-span-2",
                )}
              >
                {isEditMode && cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(index)}
                    className="absolute right-2 top-2 z-30 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <div
                  className={cn(
                    "relative overflow-hidden",
                    isTall ? "h-full min-h-[400px] sm:min-h-[500px]" : "h-56 sm:h-64",
                  )}
                  style={{ background: bgColor }}
                >
                  {/* Image */}
                  {isEditMode ? (
                    <EditableMedia
                      image={card.image}
                      imageAlt={card.title}
                      onImageChange={(src) => handleCardUpdate(index, { image: src })}
                      onVideoChange={() => {}}
                      className={cn(
                        "h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110",
                      )}
                      aspectRatio="video"
                      placeholder="Click to add image"
                      recommendedAspectRatio="16:9"
                      sectionContext={{
                        sectionType: section.type,
                        headline: card.title,
                        description: card.description,
                      }}
                    />
                  ) : card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : null}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                  {/* Content */}
                  <div className={cn("absolute bottom-0 left-0 right-0", isTall ? "p-6 sm:p-8" : "p-4 sm:p-6")}>
                    {/* Badge */}
                    <div
                      className="mb-2 inline-block px-3 py-1 text-xs font-bold uppercase sm:mb-3 sm:mb-4"
                      style={{
                        background: isTall ? bgColor : "hsl(var(--background))",
                        color: isTall ? "white" : "hsl(var(--foreground))",
                      }}
                    >
                      <EditableText
                        value={card.badge}
                        onChange={(v) => handleCardUpdate(index, { badge: v })}
                        as="span"
                      />
                    </div>

                    {/* Title */}
                    <h4 className={cn("mb-2 font-black text-white sm:mb-3", isTall ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl")}>
                      <EditableText
                        value={card.title}
                        onChange={(v) => handleCardUpdate(index, { title: v })}
                        as="span"
                      />
                    </h4>

                    {/* Description (tall card only) */}
                    {isTall && (card.description || isEditMode) && (
                      <p className="mb-4 text-sm text-gray-300 sm:mb-6 sm:text-base">
                        <EditableText
                          value={card.description || ""}
                          onChange={(v) => handleCardUpdate(index, { description: v })}
                          as="span"
                          placeholder="Description..."
                        />
                      </p>
                    )}

                    {/* Rating + Duration */}
                    <div className="flex items-center justify-between">
                      {card.rating && (
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Star className="h-4 w-4 fill-current" style={{ color: "hsl(var(--warning, 45 93% 47%))" }} />
                          <span className="font-bold">
                            <EditableText
                              value={card.rating}
                              onChange={(v) => handleCardUpdate(index, { rating: v })}
                              as="span"
                            />
                          </span>
                          {card.ratingCount && (
                            <span className="text-gray-400">
                              (<EditableText
                                value={card.ratingCount}
                                onChange={(v) => handleCardUpdate(index, { ratingCount: v })}
                                as="span"
                              />)
                            </span>
                          )}
                        </div>
                      )}
                      {card.duration && (
                        <span className="text-sm text-gray-400">
                          <EditableText
                            value={card.duration}
                            onChange={(v) => handleCardUpdate(index, { duration: v })}
                            as="span"
                          />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add card button */}
        {isEditMode && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={addCard}
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <Plus className="h-4 w-4" />
              Add Card
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

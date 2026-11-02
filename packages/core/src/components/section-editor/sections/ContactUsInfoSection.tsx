"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  ContactUsInfoContent,
  ContactUsInfoCard,
  TextStyle,
} from "@open-mtlms/shared";
import {
  Globe,
  Mail,
  MapPin,
  Phone,
  Building,
  Clock,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, LucideIcon> = {
  mail: Mail,
  phone: Phone,
  "map-pin": MapPin,
  globe: Globe,
  building: Building,
  clock: Clock,
  "message-circle": MessageCircle,
};

const iconOptions = Object.keys(iconMap);

interface ContactUsInfoSectionProps {
  section: SectionConfig;
}

export function ContactUsInfoSection({ section }: ContactUsInfoSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as ContactUsInfoContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const cards = content.cards ?? [];

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleCardUpdate = (index: number, updates: Partial<ContactUsInfoCard>) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], ...updates };
    updateSectionContent(section.id, { cards: newCards });
  };

  const addCard = () => {
    const newCard: ContactUsInfoCard = {
      id: `card-${Date.now()}`,
      icon: "mail",
      title: "New Contact",
      detail: "info@example.com",
      subtext: "Details here",
    };
    updateSectionContent(section.id, { cards: [...cards, newCard] });
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) return;
    updateSectionContent(section.id, { cards: cards.filter((_, i) => i !== index) });
  };

  return (
    <section
      className={cn(
        "py-0 pb-12 md:pb-14",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="container-custom">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = iconMap[card.icon ?? "mail"] ?? Mail;
            return (
              <div
                key={card.id}
                className="group/card relative overflow-hidden rounded-2xl border bg-card p-7 transition-all hover:-translate-y-1.5 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                {isEditMode && cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(i)}
                    className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
                    title="Remove card"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Decorative circle */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-[100px] w-[100px] rounded-full bg-primary/[0.04]" />

                {/* Icon */}
                <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-primary/[0.08]">
                  {isEditMode ? (
                    <select
                      value={card.icon ?? "mail"}
                      onChange={(e) => handleCardUpdate(i, { icon: e.target.value })}
                      className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-xs"
                      title="Choose icon"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Icon className="h-7 w-7 text-primary" />
                  )}
                </div>

                {/* Title */}
                <div className="mb-2 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  <EditableText
                    value={card.title}
                    onChange={(v) => handleCardUpdate(i, { title: v })}
                    as="span"
                   
                  />
                </div>

                {/* Detail */}
                <div className="mb-1 text-lg font-semibold">
                  <EditableText
                    value={card.detail}
                    onChange={(v) => handleCardUpdate(i, { detail: v })}
                    styleKey={`card-${i}-detail`}
                    style={content.textStyles?.[`card-${i}-detail`]}
                    onStyleChange={(s) => handleTextStyleChange(`card-${i}-detail`, s)}
                    as="span"
                   
                  />
                </div>

                {/* Subtext */}
                {(card.subtext || isEditMode) && (
                  <div className="text-sm text-muted-foreground">
                    <EditableText
                      value={card.subtext ?? ""}
                      onChange={(v) => handleCardUpdate(i, { subtext: v })}
                      as="span"
                     
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={addCard}>
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

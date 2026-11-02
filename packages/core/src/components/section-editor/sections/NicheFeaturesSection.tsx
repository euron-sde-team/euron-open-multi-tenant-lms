"use client";

import type { NicheFeatureItem, NicheFeaturesContent, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";
import { getNicheVisual, resolveNicheIcon, type NicheVariant } from "./niche-visuals";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface CardProps {
  item: NicheFeatureItem;
  index: number;
  onUpdate: (index: number, patch: Partial<NicheFeatureItem>) => void;
  onRemove: (index: number) => void;
}

function FeatureCard({ item, index, onUpdate, onRemove }: CardProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const Icon = resolveNicheIcon(item.icon);
  const revealed = inView || isEditMode;

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        transform: revealed ? "translateY(0)" : "translateY(26px)",
        opacity: revealed ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease, box-shadow 0.3s ease",
        transitionDelay: `${index * 0.08}s`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)" }}
      />
      <div
        className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
        style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="relative text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
        <EditableText value={item.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
      </h3>
      <p className="relative mt-2 text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
        <EditableText value={item.description} onChange={(v) => onUpdate(index, { description: v })} as="span" />
      </p>
      {isEditMode && (
        <button type="button" onClick={() => onRemove(index)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function NicheFeaturesSection({ section, variant }: { section: SectionConfig; variant: NicheVariant }) {
  const content = section.content as NicheFeaturesContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];
  const visual = getNicheVisual(variant);
  const Accent = visual.accentIcon;
  const Motif = visual.motifIcons;

  const update = (key: keyof NicheFeaturesContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<NicheFeatureItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () => update("items", [...items, { id: `feat-${Date.now()}`, icon: "star", title: "New Feature", description: "Describe this benefit" }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(80% 55% at 15% 0%, hsl(var(--primary) / 0.08), transparent 55%), hsl(var(--background))" }}>
      <style>{`@keyframes nicheFloat { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-18px) rotate(4deg); } }`}</style>

      {/* Floating niche motif */}
      {!isEditMode && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Motif.map((Icon, i) => (
            <Icon
              key={i}
              className="absolute"
              style={{
                left: `${8 + ((i * 27) % 84)}%`,
                top: `${12 + ((i * 33) % 70)}%`,
                width: 30 + (i % 3) * 8,
                height: 30 + (i % 3) * 8,
                color: "hsl(var(--primary) / 0.10)",
                animation: `nicheFloat ${6 + i}s ease-in-out ${i * 0.6}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <Accent className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? visual.featuresEyebrow} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" styleKey="headline" style={content.textStyles?.headline} onStyleChange={(s) => handleTextStyleChange("headline", s)} />
          </h2>
          {(content.subheadline || isEditMode) && (
            <p className="mt-3 text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableText value={content.subheadline || ""} onChange={(v) => update("subheadline", v)} as="span" placeholder="Add a short subtitle..." styleKey="subheadline" style={content.textStyles?.subheadline} onStyleChange={(s) => handleTextStyleChange("subheadline", s)} />
            </p>
          )}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <FeatureCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Feature
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import type { LanguagePhrasesContent, LanguagePhrasesItem, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { MessageCircle, Plus, Trash2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

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
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface CardProps {
  item: LanguagePhrasesItem;
  index: number;
  onUpdate: (index: number, patch: Partial<LanguagePhrasesItem>) => void;
  onRemove: (index: number) => void;
}

function PhraseCard({ item, index, onUpdate, onRemove }: CardProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [flipped, setFlipped] = useState(false);
  const revealed = inView || isEditMode;
  const showBack = isEditMode ? false : flipped;

  // In the editor we render a static, auto-height card that stacks the phrase
  // and the translation input in normal flow. The 3D-flip layout below uses
  // absolute-positioned faces plus a bottom-anchored input, which overlapped and
  // clipped the phrase text in the builder. Preview/live keeps the flip card.
  if (isEditMode) {
    return (
      <div
        ref={ref}
        className="relative flex min-h-[10rem] flex-col gap-3 rounded-2xl p-5 shadow-lg"
        style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between pr-8">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <EditableText value={item.language} onChange={(v) => onUpdate(index, { language: v })} as="span" />
          </span>
          <Volume2 className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
        </div>
        <div className="break-words text-2xl font-extrabold" style={{ color: "hsl(var(--foreground))" }}>
          <EditableText value={item.phrase} onChange={(v) => onUpdate(index, { phrase: v })} as="span" />
        </div>
        <div className="mt-auto">
          <label className="mb-1 block text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
            Translation
          </label>
          <input
            value={item.translation}
            onChange={(e) => onUpdate(index, { translation: e.target.value })}
            placeholder="Translation"
            className="w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
          />
        </div>
        <button type="button" onClick={() => onRemove(index)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      className="group relative h-40"
      style={{
        perspective: "1000px",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)",
        transitionDelay: `${index * 0.07}s`,
      }}
    >
      <div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d", transition: "transform 0.6s", transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col justify-between rounded-2xl p-5 shadow-lg"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
              <EditableText value={item.language} onChange={(v) => onUpdate(index, { language: v })} as="span" />
            </span>
            <Volume2 className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div className="text-2xl font-extrabold" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={item.phrase} onChange={(v) => onUpdate(index, { phrase: v })} as="span" />
          </div>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Hover to translate</span>
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col justify-center rounded-2xl p-5 text-center shadow-lg"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))", color: "#fff" }}
        >
          <div className="text-xl font-bold">{item.translation}</div>
        </div>
      </div>
    </div>
  );
}

export function LanguagePhrasesSection({ section }: { section: SectionConfig }) {
  const content = section.content as LanguagePhrasesContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];

  const update = (key: keyof LanguagePhrasesContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<LanguagePhrasesItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () => update("items", [...items, { id: `ph-${Date.now()}`, phrase: "Hello", translation: "Hello", language: "Spanish" }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(80% 60% at 15% 0%, hsl(var(--primary) / 0.10), transparent 55%), hsl(var(--background))" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <MessageCircle className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Everyday Phrases"} onChange={(v) => update("eyebrow", v)} as="span" />
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
            <PhraseCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Phrase
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

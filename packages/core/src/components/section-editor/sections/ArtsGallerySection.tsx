"use client";

import type { ArtsGalleryContent, ArtsGalleryItem, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { Brush, Palette, Plus, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface CardProps {
  item: ArtsGalleryItem;
  index: number;
  onUpdate: (index: number, patch: Partial<ArtsGalleryItem>) => void;
  onRemove: (index: number) => void;
}

function GalleryCard({ item, index, onUpdate, onRemove }: CardProps) {
  const { isEditMode, EditableText, EditableImage } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const tall = index % 3 === 1;

  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ rx: -((e.clientY - r.top) / r.height - 0.5) * 8, ry: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      className={`group relative ${tall ? "sm:row-span-2" : ""}`}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${inView || isEditMode ? 0 : 26}px)`,
        opacity: inView || isEditMode ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
        transitionDelay: `${index * 0.06}s`,
      }}
    >
      <div
        className={`relative h-full overflow-hidden rounded-2xl shadow-lg transition-shadow group-hover:shadow-2xl ${tall ? "min-h-[380px]" : "aspect-[4/3]"}`}
        style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
      >
        {item.image ? (
          <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Palette className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), transparent 55%)" }} />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur" style={{ backgroundColor: "hsl(var(--primary) / 0.85)" }}>
            {isEditMode ? <EditableText value={item.medium} onChange={(v) => onUpdate(index, { medium: v })} as="span" /> : item.medium}
          </span>
          <h3 className="mt-2 text-lg font-bold text-white">
            <EditableText value={item.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
          </h3>
        </div>
        {isEditMode && (
          <div className="absolute right-3 top-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
            <EditableImage src={item.image || ""} alt={item.title} onChange={(src) => onUpdate(index, { image: src })} className="h-full w-full" aspectRatio="square" placeholder="IMG" compact />
          </div>
        )}
      </div>
      {isEditMode && (
        <button type="button" onClick={() => onRemove(index)} className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ArtsGallerySection({ section }: { section: SectionConfig }) {
  const content = section.content as ArtsGalleryContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];

  const update = (key: keyof ArtsGalleryContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<ArtsGalleryItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () => update("items", [...items, { id: `art-${Date.now()}`, title: "New Piece", medium: "Mixed Media", image: "" }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(90% 60% at 10% 0%, hsl(var(--accent) / 0.10), transparent 55%), hsl(var(--background))" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <Brush className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Student Showcase"} onChange={(v) => update("eyebrow", v)} as="span" />
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
        <div className="mt-12 grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <GalleryCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Piece
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

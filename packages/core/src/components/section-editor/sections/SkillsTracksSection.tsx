"use client";

import type { SkillsTracksContent, SkillsTracksItem, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { BookOpen, Plus, Rocket, Trash2 } from "lucide-react";
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
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface CardProps {
  item: SkillsTracksItem;
  index: number;
  onUpdate: (index: number, patch: Partial<SkillsTracksItem>) => void;
  onRemove: (index: number) => void;
}

function TrackCard({ item, index, onUpdate, onRemove }: CardProps) {
  const { isEditMode, EditableText, EditableImage } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

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
      className="group relative"
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${inView || isEditMode ? 0 : 28}px)`,
        opacity: inView || isEditMode ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
        transitionDelay: `${index * 0.07}s`,
      }}
    >
      <div className="overflow-hidden rounded-2xl shadow-lg transition-shadow group-hover:shadow-2xl" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Rocket className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white backdrop-blur" style={{ backgroundColor: "hsl(var(--primary) / 0.85)" }}>
            {isEditMode ? <EditableText value={item.level} onChange={(v) => onUpdate(index, { level: v })} as="span" /> : item.level}
          </span>
          {isEditMode && (
            <div className="absolute bottom-3 right-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
              <EditableImage src={item.image || ""} alt={item.title} onChange={(src) => onUpdate(index, { image: src })} className="h-full w-full" aspectRatio="square" placeholder="IMG" />
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={item.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
          </h3>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            <BookOpen className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            <EditableText value={item.lessons} onChange={(v) => onUpdate(index, { lessons: v })} as="span" />
          </p>
        </div>
      </div>
      {isEditMode && (
        <button type="button" onClick={() => onRemove(index)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function SkillsTracksSection({ section }: { section: SectionConfig }) {
  const content = section.content as SkillsTracksContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];

  const update = (key: keyof SkillsTracksContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<SkillsTracksItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () => update("items", [...items, { id: `trk-${Date.now()}`, title: "New Track", level: "Beginner", lessons: "12 lessons", image: "" }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(90% 60% at 85% 0%, hsl(var(--accent) / 0.10), transparent 55%), hsl(var(--background))" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <Rocket className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Skill Tracks"} onChange={(v) => update("eyebrow", v)} as="span" />
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
            <TrackCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Track
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import type { NicheTestimonialItem, NicheTestimonialsContent, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { Plus, Quote, Star, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";
import { getNicheVisual, type NicheVariant } from "./niche-visuals";

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
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface CardProps {
  item: NicheTestimonialItem;
  index: number;
  onUpdate: (index: number, patch: Partial<NicheTestimonialItem>) => void;
  onRemove: (index: number) => void;
}

function TestimonialCard({ item, index, onUpdate, onRemove }: CardProps) {
  const { isEditMode, EditableText, EditableImage } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const rating = item.rating ?? 5;
  const revealed = inView || isEditMode;

  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ rx: -((e.clientY - r.top) / r.height - 0.5) * 5, ry: ((e.clientX - r.left) / r.width - 0.5) * 5 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      className="group relative rounded-2xl p-6 shadow-lg transition-shadow hover:shadow-2xl"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${revealed ? 0 : 24}px)`,
        opacity: revealed ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease, box-shadow 0.3s ease",
        transitionDelay: `${index * 0.08}s`,
      }}
    >
      <Quote className="absolute right-5 top-5 h-8 w-8" style={{ color: "hsl(var(--primary) / 0.15)" }} />
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star key={s} className="h-4 w-4" style={{ color: s < rating ? "hsl(var(--primary))" : "hsl(var(--muted))", fill: s < rating ? "hsl(var(--primary))" : "transparent" }} />
        ))}
      </div>
      <p className="relative text-sm leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
        <EditableText value={item.quote} onChange={(v) => onUpdate(index, { quote: v })} as="span" multiline />
      </p>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-full" style={{ backgroundColor: "hsl(var(--muted))" }}>
          {isEditMode ? (
            <EditableImage src={item.avatar || ""} alt={item.name} onChange={(src) => onUpdate(index, { avatar: src })} className="h-full w-full" aspectRatio="square" placeholder="IMG" />
          ) : item.avatar ? (
            <img src={item.avatar} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>
              {item.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={item.name} onChange={(v) => onUpdate(index, { name: v })} as="span" />
          </div>
          <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            <EditableText value={item.role} onChange={(v) => onUpdate(index, { role: v })} as="span" />
          </div>
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

export function NicheTestimonialsSection({ section, variant }: { section: SectionConfig; variant: NicheVariant }) {
  const content = section.content as NicheTestimonialsContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];
  const visual = getNicheVisual(variant);
  const Accent = visual.accentIcon;

  const update = (key: keyof NicheTestimonialsContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<NicheTestimonialItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () => update("items", [...items, { id: `tst-${Date.now()}`, name: "New Student", role: "Learner", quote: "Share what they loved...", avatar: "", rating: 5 }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(80% 55% at 85% 0%, hsl(var(--accent) / 0.09), transparent 55%), hsl(var(--background))" }}>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <Accent className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? visual.testimonialsEyebrow} onChange={(v) => update("eyebrow", v)} as="span" />
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
            <TestimonialCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Testimonial
            </button>
          )}
        </div>
        <VideoTestimonials section={section} />
      </div>
    </section>
  );
}

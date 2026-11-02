"use client";

import type {
  RecipesCookingContent,
  RecipesCookingItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Clock, Flame, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

interface RecipesCookingSectionProps {
  section: SectionConfig;
}

/** Reveal-on-scroll, sets a flag the first time the element enters the viewport. */
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

interface RecipeCardProps {
  item: RecipesCookingItem;
  index: number;
  onUpdate: (index: number, patch: Partial<RecipesCookingItem>) => void;
  onRemove: (index: number) => void;
}

function RecipeCard({ item, index, onUpdate, onRemove }: RecipeCardProps) {
  const { isEditMode, EditableText, EditableImage } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 9, ry: px * 9 });
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
        transitionDelay: `${index * 0.08}s`,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className="overflow-hidden rounded-2xl shadow-lg transition-shadow group-hover:shadow-2xl"
        style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 55%)" }} />
          {/* Category chip */}
          <span
            className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            style={{ backgroundColor: "hsl(var(--primary) / 0.85)" }}
          >
            {isEditMode ? (
              <EditableText value={item.category} onChange={(v) => onUpdate(index, { category: v })} as="span" />
            ) : (
              item.category
            )}
          </span>
          {isEditMode && (
            <div className="absolute bottom-3 right-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
              <EditableImage
                src={item.image || ""}
                alt={item.title}
                onChange={(src) => onUpdate(index, { image: src })}
                className="h-full w-full"
                aspectRatio="square"
                placeholder="IMG"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <h3 className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={item.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
          </h3>
          <div className="mt-3 flex items-center gap-4 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
              <EditableText value={item.time} onChange={(v) => onUpdate(index, { time: v })} as="span" />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
              <EditableText value={item.level} onChange={(v) => onUpdate(index, { level: v })} as="span" />
            </span>
          </div>
        </div>
      </div>

      {isEditMode && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow"
          aria-label="Remove recipe"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function RecipesCookingSection({ section }: RecipesCookingSectionProps) {
  const content = section.content as RecipesCookingContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];

  const update = (key: keyof RecipesCookingContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const updateItem = (index: number, patch: Partial<RecipesCookingItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    update("items", next);
  };
  const removeItem = (index: number) => update("items", items.filter((_, i) => i !== index));
  const addItem = () =>
    update("items", [
      ...items,
      { id: `recipe-${Date.now()}`, title: "New Recipe", category: "Main", time: "30 min", level: "Beginner", image: "" },
    ]);

  return (
    <section
      className="relative overflow-hidden py-16 sm:py-24"
      style={{
        background: "radial-gradient(100% 80% at 85% 0%, hsl(var(--accent) / 0.08), transparent 60%), hsl(var(--background))",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}
          >
            <UtensilsCrossed className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Signature Recipes"} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText
              value={content.headline}
              onChange={(v) => update("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
          </h2>
          {(content.subheadline || isEditMode) && (
            <p className="mt-3 text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableText
                value={content.subheadline || ""}
                onChange={(v) => update("subheadline", v)}
                as="span"
                placeholder="Add a short subtitle..."
                styleKey="subheadline"
                style={content.textStyles?.subheadline}
                onStyleChange={(s) => handleTextStyleChange("subheadline", s)}
              />
            </p>
          )}
        </div>

        {/* Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <RecipeCard key={item.id} item={item} index={i} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button
              type="button"
              onClick={addItem}
              className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              <Plus className="h-6 w-6" />
              Add Recipe
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

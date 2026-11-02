"use client";

import type {
  GenresMusicContent,
  GenresMusicItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Disc3, Music, Plus, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

interface GenresMusicSectionProps {
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

const EQ_BARS = [0.5, 0.8, 0.35, 1, 0.6, 0.9, 0.45, 0.75];

interface GenreCardProps {
  item: GenresMusicItem;
  index: number;
  animate: boolean;
  onUpdate: (index: number, patch: Partial<GenresMusicItem>) => void;
  onRemove: (index: number) => void;
}

function GenreCard({ item, index, animate, onUpdate, onRemove }: GenreCardProps) {
  const { isEditMode, EditableText, EditableImage } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 8, ry: px * 8 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      className="group relative"
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateY(${inView || isEditMode ? 0 : 30}px)`,
        opacity: inView || isEditMode ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
        transitionDelay: `${index * 0.07}s`,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg transition-shadow group-hover:shadow-2xl"
        style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(9,6,20,0.9) 0%, rgba(9,6,20,0.25) 55%, transparent 100%)" }} />

          {/* Level chip */}
          <span
            className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold text-white backdrop-blur"
            style={{ backgroundColor: "hsl(var(--primary) / 0.85)" }}
          >
            {isEditMode ? (
              <EditableText value={item.level} onChange={(v) => onUpdate(index, { level: v })} as="span" />
            ) : (
              item.level
            )}
          </span>

          {isEditMode && (
            <div className="absolute right-3 top-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
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

          {/* Equalizer + title over image */}
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="mb-2.5 flex h-6 items-end gap-1" aria-hidden>
              {EQ_BARS.map((h, b) => (
                <span
                  key={b}
                  className="w-1 rounded-full"
                  style={{
                    height: `${h * 100}%`,
                    backgroundColor: "hsl(var(--primary))",
                    transformOrigin: "bottom",
                    animation: animate ? `genreEq 1s ease-in-out ${b * 0.09}s infinite alternate` : undefined,
                  }}
                />
              ))}
            </div>
            <h3 className="text-xl font-bold leading-tight text-white">
              <EditableText value={item.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
            </h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Disc3 className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
              <EditableText value={item.tracks} onChange={(v) => onUpdate(index, { tracks: v })} as="span" />
            </p>
          </div>
        </div>
      </div>

      {isEditMode && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow"
          aria-label="Remove genre"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function GenresMusicSection({ section }: GenresMusicSectionProps) {
  const content = section.content as GenresMusicContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];
  const animate = !isEditMode;

  const update = (key: keyof GenresMusicContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const updateItem = (index: number, patch: Partial<GenresMusicItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    update("items", next);
  };
  const removeItem = (index: number) => update("items", items.filter((_, i) => i !== index));
  const addItem = () =>
    update("items", [
      ...items,
      { id: `genre-${Date.now()}`, title: "New Genre", tracks: "20 lessons", level: "All Levels", image: "" },
    ]);

  return (
    <section
      className="relative overflow-hidden py-16 sm:py-24"
      style={{
        background:
          "radial-gradient(70% 50% at 20% 10%, hsl(var(--primary) / 0.14), transparent 60%), radial-gradient(60% 50% at 90% 90%, hsl(var(--accent) / 0.12), transparent 60%), hsl(var(--background))",
      }}
    >
      <style>{`
        @keyframes genreEq { 0%{transform:scaleY(0.3)} 100%{transform:scaleY(1)} }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: "hsl(var(--primary) / 0.14)", color: "hsl(var(--primary))" }}
          >
            <Music className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Explore Genres"} onChange={(v) => update("eyebrow", v)} as="span" />
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
            <GenreCard key={item.id} item={item} index={i} animate={animate} onUpdate={updateItem} onRemove={removeItem} />
          ))}
          {isEditMode && (
            <button
              type="button"
              onClick={addItem}
              className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              <Plus className="h-6 w-6" />
              Add Genre
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import type {
  OutcomesBusinessContent,
  OutcomesBusinessMetric,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowUpRight, Plus, TrendingUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";

interface OutcomesBusinessSectionProps {
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
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

interface MetricCardProps {
  metric: OutcomesBusinessMetric;
  index: number;
  onUpdate: (index: number, patch: Partial<OutcomesBusinessMetric>) => void;
  onRemove: (index: number) => void;
}

function MetricCard({ metric, index, onUpdate, onRemove }: MetricCardProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const revealed = inView || isEditMode;

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-2xl p-6 transition-shadow hover:shadow-xl"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        transform: revealed ? "translateY(0)" : "translateY(28px)",
        opacity: revealed ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease, box-shadow 0.3s ease",
        transitionDelay: `${index * 0.08}s`,
      }}
    >
      {/* Corner accent */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.16), transparent 70%)" }}
      />
      <div
        className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
      >
        <ArrowUpRight className="h-5 w-5" />
      </div>

      <div className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: "hsl(var(--primary))" }}>
        <EditableText value={metric.value} onChange={(v) => onUpdate(index, { value: v })} as="span" />
      </div>

      {/* Growth bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "hsl(var(--muted))" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: revealed ? "100%" : "0%",
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
            transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)",
            transitionDelay: `${index * 0.08 + 0.15}s`,
          }}
        />
      </div>

      <h3 className="mt-4 text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
        <EditableText value={metric.label} onChange={(v) => onUpdate(index, { label: v })} as="span" />
      </h3>
      <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
        <EditableText value={metric.description} onChange={(v) => onUpdate(index, { description: v })} as="span" />
      </p>

      {isEditMode && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow"
          aria-label="Remove metric"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function OutcomesBusinessSection({ section }: OutcomesBusinessSectionProps) {
  const content = section.content as OutcomesBusinessContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const metrics = content.metrics ?? [];

  const update = (key: keyof OutcomesBusinessContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const updateMetric = (index: number, patch: Partial<OutcomesBusinessMetric>) => {
    const next = [...metrics];
    next[index] = { ...next[index], ...patch };
    update("metrics", next);
  };
  const removeMetric = (index: number) => update("metrics", metrics.filter((_, i) => i !== index));
  const addMetric = () =>
    update("metrics", [
      ...metrics,
      { id: `metric-${Date.now()}`, value: "00%", label: "New Metric", description: "Describe this result" },
    ]);

  return (
    <section
      className="relative overflow-hidden py-16 sm:py-24"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--background)), hsl(var(--muted) / 0.35))",
      }}
    >
      {/* Dotted grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(100% 100% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(100% 100% at 50% 0%, black, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
          >
            <TrendingUp className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Proven Outcomes"} onChange={(v) => update("eyebrow", v)} as="span" />
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
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, i) => (
            <MetricCard key={metric.id} metric={metric} index={i} onUpdate={updateMetric} onRemove={removeMetric} />
          ))}
          {isEditMode && (
            <button
              type="button"
              onClick={addMetric}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
            >
              <Plus className="h-6 w-6" />
              Add Metric
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

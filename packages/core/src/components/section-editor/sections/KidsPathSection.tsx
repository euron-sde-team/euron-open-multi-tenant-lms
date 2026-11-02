"use client";

import type { KidsPathContent, KidsPathStep, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { Plus, Sparkles, Trash2 } from "lucide-react";
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

interface StepProps {
  step: KidsPathStep;
  index: number;
  animate: boolean;
  onUpdate: (index: number, patch: Partial<KidsPathStep>) => void;
  onRemove: (index: number) => void;
}

const STEP_COLORS = ["#f9a8d4", "#fcd34d", "#6ee7b7", "#93c5fd", "#c4b5fd", "#fca5a5"];

function PathStep({ step, index, animate, onUpdate, onRemove }: StepProps) {
  const { isEditMode, EditableText } = useSectionEditor();
  const { ref, inView } = useInView<HTMLDivElement>();
  const color = STEP_COLORS[index % STEP_COLORS.length];
  const revealed = inView || isEditMode;

  return (
    <div
      ref={ref}
      className="group relative"
      style={{
        transform: revealed ? "translateY(0)" : "translateY(26px)",
        opacity: revealed ? 1 : 0,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.6s ease",
        transitionDelay: `${index * 0.1}s`,
      }}
    >
      <div className="rounded-[1.75rem] p-6 text-center shadow-lg" style={{ backgroundColor: "hsl(var(--card))", border: "2px solid hsl(var(--border))" }}>
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl"
          style={{ backgroundColor: color, animation: animate ? `kidBob 3s ease-in-out ${index * 0.3}s infinite` : undefined }}
        >
          {isEditMode ? (
            <EditableText value={step.emoji} onChange={(v) => onUpdate(index, { emoji: v })} as="span" />
          ) : (
            <span>{step.emoji}</span>
          )}
        </div>
        <div className="mx-auto mt-4 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: "hsl(var(--primary))" }}>
          {index + 1}
        </div>
        <h3 className="mt-3 text-lg font-extrabold" style={{ color: "hsl(var(--foreground))" }}>
          <EditableText value={step.title} onChange={(v) => onUpdate(index, { title: v })} as="span" />
        </h3>
        <p className="mt-1.5 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          <EditableText value={step.description} onChange={(v) => onUpdate(index, { description: v })} as="span" />
        </p>
      </div>
      {isEditMode && (
        <button type="button" onClick={() => onRemove(index)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function KidsPathSection({ section }: { section: SectionConfig }) {
  const content = section.content as KidsPathContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const steps = content.steps ?? [];
  const animate = !isEditMode;

  const update = (key: keyof KidsPathContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateStep = (i: number, patch: Partial<KidsPathStep>) => {
    const next = [...steps];
    next[i] = { ...next[i], ...patch };
    update("steps", next);
  };
  const removeStep = (i: number) => update("steps", steps.filter((_, idx) => idx !== i));
  const addStep = () => update("steps", [...steps, { id: `step-${Date.now()}`, emoji: "⭐", title: "New Step", description: "Describe this step" }]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: "radial-gradient(80% 60% at 90% 0%, hsl(var(--accent) / 0.14), transparent 55%), hsl(var(--background))" }}>
      <style>{`@keyframes kidBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <Sparkles className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "How It Works"} onChange={(v) => update("eyebrow", v)} as="span" />
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
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <PathStep key={step.id} step={step} index={i} animate={animate} onUpdate={updateStep} onRemove={removeStep} />
          ))}
          {isEditMode && (
            <button type="button" onClick={addStep} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add Step
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

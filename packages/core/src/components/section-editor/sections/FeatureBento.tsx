"use client";

import type { FeatureBentoContent, FeatureBentoItem, SectionConfig, TextStyle } from "@open-mtlms/shared";
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  Code,
  Globe,
  GraduationCap,
  Heart,
  Layers,
  Lightbulb,
  LineChart,
  MessageCircle,
  Palette,
  Plus,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  Trophy,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { useSectionEditor } from "../SectionEditorContext";
import { Reveal, Stagger, StaggerItem } from "../motion";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, rocket: Rocket, zap: Zap, target: Target, trophy: Trophy, award: Award,
  users: Users, "book-open": BookOpen, "graduation-cap": GraduationCap, brain: Brain, code: Code,
  palette: Palette, "line-chart": LineChart, "shield-check": ShieldCheck, shield: Shield, layers: Layers,
  "wand-2": Wand2, lightbulb: Lightbulb, "check-circle": CheckCircle, clock: Clock, globe: Globe,
  "message-circle": MessageCircle, heart: Heart, star: Star,
};
const ICON_NAMES = Object.keys(ICONS);

function BentoIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = ICONS[name ?? ""] ?? Sparkles;
  return <Cmp className={className ?? "h-6 w-6"} />;
}

/** Inline icon picker shown only in edit mode. Click the icon to swap it. */
function IconEditor({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group/icn flex h-12 w-12 items-center justify-center rounded-2xl ring-2 ring-transparent transition hover:ring-[hsl(var(--primary))]"
        style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
        title="Change icon"
      >
        <BentoIcon name={value} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-14 z-30 grid w-[232px] grid-cols-6 gap-1 rounded-xl border p-2 shadow-2xl" style={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            {ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { onChange(n); setOpen(false); }}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-[hsl(var(--muted))]"
                style={{ color: value === n ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", backgroundColor: value === n ? "hsl(var(--primary) / 0.12)" : undefined }}
              >
                <BentoIcon name={n} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function spanClass(size?: FeatureBentoItem["size"]) {
  if (size === "lg") return "sm:col-span-2 sm:row-span-2";
  if (size === "md") return "sm:col-span-2";
  return "";
}

export function FeatureBento({ section }: { section: SectionConfig }) {
  const content = section.content as FeatureBentoContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const items = content.items ?? [];

  const update = (key: keyof FeatureBentoContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateItem = (i: number, patch: Partial<FeatureBentoItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    update("items", next);
  };
  const removeItem = (i: number) => update("items", items.filter((_, idx) => idx !== i));
  const addItem = () =>
    update("items", [...items, { id: `feat-${Date.now()}`, icon: "sparkles", title: "New feature", description: "Describe this benefit." }]);

  return (
    <section className="py-20 sm:py-24" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal disabled={isEditMode} className="mx-auto max-w-2xl text-center">
          {(content.eyebrow || isEditMode) && (
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
              <Sparkles className="h-4 w-4" />
              <EditableText value={content.eyebrow || "Why choose us"} onChange={(v) => update("eyebrow", v)} as="span" />
            </span>
          )}
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" styleKey="headline" style={content.textStyles?.headline} onStyleChange={(s) => handleTextStyleChange("headline", s)} multiline />
          </h2>
          {(content.subheadline || isEditMode) && (
            <p className="mt-4 text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableText value={content.subheadline || ""} onChange={(v) => update("subheadline", v)} as="span" placeholder="Add a supporting line..." />
            </p>
          )}
        </Reveal>

        <Stagger disabled={isEditMode} className="mt-12 grid auto-rows-[minmax(150px,auto)] grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, i) => (
            <StaggerItem key={item.id} className={`${spanClass(item.size)} h-full`}>
              <div
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition-shadow hover:shadow-xl"
                style={{ borderColor: "hsl(var(--border))", background: item.size === "lg" ? "linear-gradient(155deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.08))" : "hsl(var(--card))" }}
              >
                {isEditMode ? (
                  <IconEditor value={item.icon} onChange={(name) => updateItem(i, { icon: name })} />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                    <BentoIcon name={item.icon} />
                  </span>
                )}
                <h3 className="mt-5 text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
                  <EditableText value={item.title} onChange={(v) => updateItem(i, { title: v })} as="span" />
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText value={item.description} onChange={(v) => updateItem(i, { description: v })} as="span" />
                </p>
                {isEditMode && (
                  <button type="button" onClick={() => removeItem(i)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow" aria-label="Remove card">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
          {isEditMode && (
            <button type="button" onClick={addItem} className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-6 w-6" />
              Add card
            </button>
          )}
        </Stagger>
      </div>
    </section>
  );
}

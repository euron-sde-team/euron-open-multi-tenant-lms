"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import {
  ArrowRight,
  Cake,
  ChefHat,
  Coffee,
  Pizza,
  Soup,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableStringList } from "../EditableStringList";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroCookingSectionProps {
  section: SectionConfig;
}

const CATEGORY_PILLS = ["Baking", "Grilling", "Pastry", "Vegan", "World Cuisine"];

// Decorative floating food icons scattered around the hero (position + delay).
const FLOATERS = [
  { Icon: Pizza, top: "12%", left: "6%", size: 30, delay: 0 },
  { Icon: Coffee, top: "68%", left: "10%", size: 26, delay: 1.1 },
  { Icon: Cake, top: "20%", right: "8%", size: 28, delay: 0.6 },
  { Icon: Soup, top: "78%", right: "14%", size: 30, delay: 1.6 },
];

/**
 * Cooking hero, a warm, animated split layout: drifting gradient orbs, floating
 * food icons, a rotating dashed "plate" ring behind a gently floating dish image,
 * a bobbing chef's-pick badge, and staggered fade-up entrance for the copy.
 * All colors come from the active theme via HSL vars. Entrance motion is skipped
 * in edit mode so authoring stays stable; ambient motion always runs.
 */
export function HeroCookingSection({ section }: HeroCookingSectionProps) {
  const content = section.content as HeroPhotographyContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableImage,
    LinkComponent,
  } = useSectionEditor();

  const resolveHref = (href: string) =>
    !href || href.startsWith("#") ? "/all-courses" : href;

  const update = (key: keyof HeroPhotographyContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const stats = content.stats ?? [];

  // Staggered entrance, disabled in edit mode to avoid flicker on every edit.
  const enter = (i: number): CSSProperties =>
    isEditMode
      ? {}
      : { animation: `cookFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${i * 0.09}s` };

  return (
    <section
      className="relative grid min-h-[100svh] items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 120% at 15% 10%, hsl(var(--accent) / 0.10), transparent 55%), hsl(var(--background))",
      }}
    >
      <style>{`
        @keyframes cookFadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes cookFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes cookBob { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-9px) rotate(1deg); } }
        @keyframes cookOrbA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(34px,-24px) scale(1.12); } }
        @keyframes cookOrbB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-28px,22px) scale(1.16); } }
        @keyframes cookSpin { to { transform: rotate(360deg); } }
        @keyframes cookGlow { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }
      `}</style>

      {/* Drifting gradient orbs */}
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: "hsl(var(--accent))", opacity: 0.18, animation: isEditMode ? undefined : "cookOrbA 14s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 left-[18%] h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: "hsl(var(--primary))", opacity: 0.12, animation: isEditMode ? undefined : "cookOrbB 18s ease-in-out infinite" }}
      />

      {/* Floating food icons */}
      {FLOATERS.map(({ Icon, delay, size, ...pos }, i) => (
        <div
          key={i}
          className="pointer-events-none absolute hidden lg:block"
          style={{ ...pos, color: "hsl(var(--primary) / 0.35)", animation: isEditMode ? undefined : `cookFloat ${5 + i}s ease-in-out infinite`, animationDelay: `${delay}s` }}
        >
          <Icon style={{ width: size, height: size }} />
        </div>
      ))}

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        {/* Left, copy */}
        <div className="min-w-0 space-y-6">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", ...enter(0) }}
          >
            <ChefHat className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "The Culinary Academy"} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>

          <h1
            className="break-words text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "hsl(var(--foreground))", ...enter(1) }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => update("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              multiline
            />
          </h1>

          {(content.description || isEditMode) && (
            <p className="max-w-xl text-lg leading-relaxed" style={{ color: "hsl(var(--muted-foreground))", ...enter(2) }}>
              <EditableText
                value={content.description || ""}
                onChange={(v) => update("description", v)}
                as="span"
                placeholder="Add a compelling subtitle..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}

          <div className="flex flex-wrap gap-2" style={enter(3)}>
            <EditableStringList
              items={content.tileItems?.categoryPills ?? CATEGORY_PILLS}
              onChange={(next) =>
                update("tileItems", { ...content.tileItems, categoryPills: next })
              }
              newItemValue="New category"
              addLabel="+ Category"
              renderItem={(node, i) => (
                <span
                  key={i}
                  className="rounded-full border px-3 py-1 text-sm font-medium transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground) / 0.8)", backgroundColor: "hsl(var(--card))" }}
                >
                  {node}
                </span>
              )}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2" style={enter(4)}>
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })}
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button
                  type="button"
                  className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                  style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                        as="span"
                        styleKey="primaryCta"
                        style={content.textStyles?.primaryCta}
                        onStyleChange={(s) => handleTextStyleChange("primaryCta", s)}
                      />
                      <ArrowRight className="h-5 w-5" />
                    </>
                  ) : (
                    <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                      {content.primaryCta.text}
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
            {content.secondaryCta && !content.secondaryCta.hidden && (
              <EditableClickable
                href={content.secondaryCta.href}
                onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })}
                hidden={content.secondaryCta.hidden}
                onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Secondary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-base font-semibold transition-colors hover:bg-[hsl(var(--primary)/0.06)]"
                  style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))", backgroundColor: "transparent" }}
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.secondaryCta.text}
                      onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                      as="span"
                      styleKey="secondaryCta"
                      style={content.textStyles?.secondaryCta}
                      onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
                    />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {stats.length > 0 && (
            <div className="flex flex-wrap gap-8 border-t pt-6" style={{ borderColor: "hsl(var(--border))", ...enter(5) }}>
              {stats.map((stat: HeroPhotographyStat, i: number) => (
                <div key={stat.id}>
                  <div className="text-2xl font-extrabold sm:text-3xl" style={{ color: "hsl(var(--primary))" }}>
                    <EditableText
                      value={stat.value}
                      onChange={(v) => {
                        const next = [...stats];
                        next[i] = { ...next[i], value: v };
                        update("stats", next);
                      }}
                      as="span"
                    />
                  </div>
                  <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <EditableText
                      value={stat.label}
                      onChange={(v) => {
                        const next = [...stats];
                        next[i] = { ...next[i], label: v };
                        update("stats", next);
                      }}
                      as="span"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right, image with rotating ring + glow */}
        <div className="relative flex items-center justify-center" style={enter(3)}>
          {/* Rotating dashed plate ring */}
          <div
            className="pointer-events-none absolute aspect-square w-[108%] rounded-full border-2 border-dashed"
            style={{ borderColor: "hsl(var(--primary) / 0.25)", animation: isEditMode ? undefined : "cookSpin 40s linear infinite" }}
          />
          {/* Soft glow */}
          <div
            className="pointer-events-none absolute h-[80%] w-[80%] rounded-full blur-3xl"
            style={{ backgroundColor: "hsl(var(--accent))", animation: isEditMode ? undefined : "cookGlow 6s ease-in-out infinite" }}
          />

          <div
            className="relative w-full max-w-md"
            style={{ animation: isEditMode ? undefined : "cookFloat 7s ease-in-out infinite" }}
          >
            <div className="relative overflow-hidden rounded-[2rem] shadow-2xl" style={{ aspectRatio: "4 / 5" }}>
              {content.image ? (
                <img src={content.image} alt={content.imageAlt || "Featured dish"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "hsl(var(--muted))" }}>
                  <UtensilsCrossed className="h-16 w-16" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              )}
              {isEditMode && (
                <div className="absolute bottom-4 right-4 h-12 w-12 overflow-hidden rounded-lg border-2 border-white/60">
                  <EditableImage
                    src={content.image || ""}
                    alt={content.imageAlt || "Featured dish"}
                    onChange={(src) => update("image", src)}
                    className="h-full w-full"
                    aspectRatio="square"
                    placeholder="IMG"
                  />
                </div>
              )}
            </div>

            {/* Floating chef's pick badge */}
            <div
              className="absolute -left-4 bottom-10 hidden items-center gap-3 rounded-2xl px-4 py-3 shadow-xl sm:flex"
              style={{ backgroundColor: "hsl(var(--card))", animation: isEditMode ? undefined : "cookBob 4.5s ease-in-out infinite" }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}
              >
                <Star className="h-5 w-5" fill="currentColor" />
              </span>
              <div>
                <div className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>Chef&apos;s Pick</div>
                <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Top-rated recipes</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

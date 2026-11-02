"use client";

import type {
  HeroInstitutionItem,
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import {
  ArrowRight,
  Calendar,
  GraduationCap,
  Plus,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroQuantInstituteSectionProps {
  section: SectionConfig;
}

const STAT_ICONS: LucideIcon[] = [GraduationCap, Users, TrendingUp];

// The editorial serif used for the three headline lines. Loaded by the
// component itself (theme fonts stay sans for the rest of the page, and the
// shared Google Fonts pipeline does not load the italic axis this design
// depends on, faux italics would break the reference fidelity).
const SERIF = { fontFamily: "'Source Serif 4', Georgia, serif" } as const;

/** Render `**bold**` markers in the description as emphasized foreground
 *  segments (view mode only, edit mode shows the raw, editable markers). */
const renderRich = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i} className="font-bold" style={{ color: "hsl(var(--foreground))" }}>
        {seg.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{seg}</span>
    ),
  );

/**
 * Quant Institute hero, a light, editorial split hero: italic serif eyebrow
 * and three-line headline (foreground / primary / foreground), a short accent
 * rule, bold-phrase description, dual CTAs, an icon stats row with hairline
 * dividers, a "trusted by" line, a bottom-right anchored photo and a
 * full-width institution wordmark bar. Fully token-driven so the tenant theme
 * (and its dark block) restyles it like any other section.
 */
export function HeroQuantInstituteSection({ section }: HeroQuantInstituteSectionProps) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } =
    useSectionEditor();

  const resolveHref = (href: string) =>
    !href || href.startsWith("#") ? "/all-courses" : href;
  const update = (key: string, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const stats: HeroPhotographyStat[] = content.stats ?? [];
  const institutions: HeroInstitutionItem[] = content.institutions ?? [];

  const updateStat = (index: number, updates: Partial<HeroPhotographyStat>) => {
    const next = [...stats];
    next[index] = { ...next[index], ...updates };
    update("stats", next);
  };
  const updateInstitution = (index: number, updates: Partial<HeroInstitutionItem>) => {
    const next = [...institutions];
    next[index] = { ...next[index], ...updates };
    update("institutions", next);
  };
  const addInstitution = () =>
    update("institutions", [
      ...institutions,
      { id: `inst-${Date.now()}`, name: "Institution" },
    ]);
  const removeInstitution = (index: number) => {
    if (institutions.length <= 1) return;
    update(
      "institutions",
      institutions.filter((_, i) => i !== index),
    );
  };

  const enter = (i: number): CSSProperties =>
    isEditMode
      ? {}
      : {
          animation: "qiFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
          animationDelay: `${i * 0.09}s`,
        };

  // Client direction: only the accent line ("Quantitative Finance.") is
  // italic; the flanking lines are upright serif.
  const headlineLine =
    "qi-hl text-[2rem] font-semibold leading-[1.12] tracking-[-0.015em] sm:text-[clamp(2.625rem,5.55vw,5.25rem)] sm:leading-[1.05]";

  return (
    <section className="qi-hero relative overflow-hidden bg-background">
      {/* Self-loaded display serif with real italics (see SERIF note above). */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,600;0,8..60,700;1,8..60,600;1,8..60,700&display=swap"
      />
      {/* dangerouslySetInnerHTML, not a text child: React escapes text
          children during SSR (an apostrophe becomes &#x27;), but <style> is a
          raw-text element so the browser never decodes it back, the markup
          mismatches on hydration and the CSS ships with a literal entity. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes qiFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes qiMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .qi-marquee { animation: qiMarquee 38s linear infinite; }
        .qi-marquee:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .qi-marquee { animation: none; } }
        /* Height-aware desktop scaling: the reference proportions are designed
           for ~1024px-tall viewports. On shorter laptop viewports, compact the
           vertical rhythm so hero + institution bar + bottom margin still land
           inside the fold below the site navbar. Two-class selectors outrank
           Tailwind utilities, so no !important is needed. */
        @media (min-width: 1024px) and (max-height: 940px) {
          .qi-hero .qi-hl { font-size: clamp(2.25rem, 4.7vw, 4.25rem); }
          .qi-hero .qi-left { padding-top: 1.5rem; padding-bottom: 1.5rem; }
          .qi-hero .qi-desc { margin-top: 1.125rem; font-size: 1rem; }
          /* Even vertical rhythm: description → CTAs → stats → trust/logos
             all breathe with equivalent white gaps. */
          .qi-hero .qi-ctas { margin-top: 1.75rem; }
          .qi-hero .qi-ctas button { padding-top: 0.75rem; padding-bottom: 0.75rem; }
          .qi-hero .qi-stats { margin-top: 1.75rem; }
          .qi-hero .qi-stat-circle { height: 3.25rem; width: 3.25rem; }
          .qi-hero .qi-stat-value { font-size: 1.5rem; }
          .qi-hero .qi-logo-bar { margin-top: 1rem; padding-top: 1.25rem; padding-bottom: 1.75rem; }
          .qi-hero .qi-logo { height: 3rem; }
          /* Keep the photo's head-room clear of the navbar/search chrome on
             shorter laptop screens. */
          .qi-hero .qi-photo { height: 80%; }
          /* The box is now short, so a bottom-anchored cover crops the
             subject's head. Bias the crop upward to keep the head in frame. */
          .qi-hero .qi-photo img { object-position: 50% 34%; }
        }
        @media (min-width: 1024px) and (max-height: 850px) {
          .qi-hero .qi-hl { font-size: clamp(2rem, 4.1vw, 3.625rem); }
          .qi-hero .qi-stat-circle { height: 3rem; width: 3rem; }
          .qi-hero .qi-stat-value { font-size: 1.375rem; }
          .qi-hero .qi-logo { height: 2.5rem; }
          .qi-hero .qi-photo { height: 76%; }
          .qi-hero .qi-photo img { object-position: 50% 20%; }
        }
        @media (min-width: 1024px) and (max-height: 760px) {
          .qi-hero .qi-photo img { object-position: 50% 10%; }
        }
        /* Mobile: the shared body sections pad with a flat 5rem; tighten the
           rhythm on small screens for pages built on this template (this
           style tag only exists on pages that include this hero, so the
           rules are page-scoped). section.py-10 compacts the AI showcase
           sections, element+class specificity outranks the Tailwind
           utility. */
        @media (max-width: 640px) {
          :root { --section-padding-y: 2.25rem; }
          section.py-10 { padding-top: 2rem; padding-bottom: 2rem; }
        }
      ` }} />

      {/* ── Top zone: copy left, photo bottom-right (flush to the viewport
             edge and to the logo bar, per the reference) ── */}
      <div className="relative">
        {/* min-h leaves ~16rem of viewport budget for the site navbar + the
            logo bar below, so hero + logo bar land within one screen. */}
        <div className="mx-auto grid max-w-[1600px] px-4 sm:px-6 lg:min-h-[min(calc(100svh-17rem),720px)] lg:grid-cols-[52%_48%] lg:px-16">
          {/* Left column (z-10 keeps stats/text above the photo overlay at
              narrower desktop widths) */}
          <div className="qi-left relative z-10 flex flex-col justify-center py-10 sm:py-14 lg:py-8">
          {/* Eyebrow (sans italic, per reference) */}
          {(content.eyebrow || isEditMode) && (
            <p
              className="text-base font-medium italic sm:text-lg"
              style={{ color: "hsl(var(--primary))", ...enter(0) }}
            >
              <EditableText
                value={content.eyebrow ?? ""}
                onChange={(v) => update("eyebrow", v)}
                as="span"
                placeholder="Eyebrow line..."
              />
            </p>
          )}

          {/* Three-line serif headline */}
          <h1 className="mt-5" style={{ ...SERIF, ...enter(1) }}>
            <span className={`block text-foreground ${headlineLine}`}>
              <EditableText
                value={content.headline}
                onChange={(v) => update("headline", v)}
                as="span"
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
              />
            </span>
            {(content.headlineAccent || isEditMode) && (
              <span
                className={`block italic ${headlineLine}`}
                style={{ color: "hsl(var(--primary))" }}
              >
                <EditableText
                  value={content.headlineAccent ?? ""}
                  onChange={(v) => update("headlineAccent", v)}
                  as="span"
                  placeholder="Accent line..."
                  styleKey="headlineAccent"
                  style={content.textStyles?.headlineAccent}
                  onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                />
              </span>
            )}
            {(content.headlineSuffix || isEditMode) && (
              <span className={`block text-foreground ${headlineLine}`}>
                <EditableText
                  value={content.headlineSuffix ?? ""}
                  onChange={(v) => update("headlineSuffix", v)}
                  as="span"
                  placeholder="Closing line..."
                  styleKey="headlineSuffix"
                  style={content.textStyles?.headlineSuffix}
                  onStyleChange={(s) => handleTextStyleChange("headlineSuffix", s)}
                />
              </span>
            )}
          </h1>

          {/* Accent rule */}
          <div
            aria-hidden="true"
            className="mt-5 h-1 w-[70px] rounded-full"
            style={{ backgroundColor: "hsl(var(--primary))", ...enter(2) }}
          />

          {/* Description with **bold** phrases */}
          {(content.description || isEditMode) && (
            <p
              className="qi-desc mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:whitespace-pre-line sm:text-[1.0625rem]"
              style={enter(3)}
            >
              {isEditMode ? (
                <EditableText
                  value={content.description ?? ""}
                  onChange={(v) => update("description", v)}
                  as="span"
                  placeholder="Add a description (wrap key phrases in **double asterisks** to bold them)..."
                  styleKey="description"
                  style={content.textStyles?.description}
                  onStyleChange={(s) => handleTextStyleChange("description", s)}
                  multiline
                />
              ) : (
                renderRich(content.description ?? "")
              )}
            </p>
          )}

          {/* CTAs */}
          <div className="qi-ctas mt-6 flex flex-wrap items-center gap-3 sm:mt-7" style={enter(4)}>
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
                  className="group inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] sm:px-7 sm:py-4 sm:text-base"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 10px 26px -10px hsl(var(--primary) / 0.55)",
                  }}
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
                    <LinkComponent
                      href={resolveHref(content.primaryCta.href)}
                      className="inline-flex items-center gap-2"
                    >
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
                onHiddenChange={(hidden) =>
                  update("secondaryCta", { ...content.secondaryCta, hidden })
                }
                isEditing={isEditMode}
                slotLabel="Secondary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2.5 rounded-lg bg-background px-5 py-3 text-sm font-semibold transition-colors hover:bg-primary/5 sm:gap-3 sm:px-8 sm:py-4 sm:text-base"
                  style={{
                    border: "1.5px solid hsl(var(--primary))",
                    color: "hsl(var(--primary))",
                  }}
                >
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
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
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>
                      {content.secondaryCta.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Stats row */}
          {stats.length > 0 && (
            <div
              className="qi-stats mt-8 grid grid-cols-2 gap-x-3 gap-y-4 sm:mt-9 sm:flex sm:gap-0 sm:divide-x sm:divide-border"
              style={enter(5)}
            >
              {stats.slice(0, 4).map((stat, i) => {
                const Icon = STAT_ICONS[i] ?? TrendingUp;
                return (
                  <div
                    key={stat.id}
                    className="flex items-center gap-2.5 sm:gap-4 sm:px-5 sm:first:pl-0 sm:last:pr-0 xl:px-7"
                  >
                    <span
                      className="qi-stat-circle flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] dark:bg-primary/15 sm:h-14 sm:w-14 xl:h-16 xl:w-16"
                      aria-hidden="true"
                    >
                      <Icon
                        className="h-5 w-5 sm:h-7 sm:w-7 xl:h-8 xl:w-8"
                        strokeWidth={1.75}
                        style={{ color: "hsl(var(--primary))" }}
                      />
                    </span>
                    <div className="min-w-0">
                      <div
                        className="qi-stat-value text-lg font-bold leading-tight sm:text-2xl xl:text-[1.75rem]"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        <EditableText
                          value={stat.value}
                          onChange={(v) => updateStat(i, { value: v })}
                          as="span"
                        />
                      </div>
                      <div className="mt-0.5 whitespace-pre-line text-xs leading-snug text-muted-foreground/90 sm:mt-1 sm:text-base">
                        <EditableText
                          value={stat.label}
                          onChange={(v) => updateStat(i, { label: v })}
                          as="span"
                          multiline
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

          {/* Right column: bottom-anchored photo (flush right on lg via the
              absolute overlay below; static stacked image on smaller screens) */}
          <div className="relative order-last flex items-end justify-center lg:hidden">
            {content.image ? (
              <img
                src={content.image}
                alt={content.imageAlt ?? ""}
                className="w-full max-w-sm object-contain object-bottom sm:max-w-md"
                style={{
                  maskImage:
                    "radial-gradient(160% 145% at 75% 80%, black 64%, transparent 95%)",
                  WebkitMaskImage:
                    "radial-gradient(160% 145% at 75% 80%, black 64%, transparent 95%)",
                }}
              />
            ) : (
              <div className="h-64 w-full max-w-md rounded-2xl bg-muted" />
            )}
          </div>
        </div>

        {/* Photo overlay for lg+: flush to the right viewport edge, bottom
            resting on the logo bar. */}
        <div className="qi-photo pointer-events-none absolute bottom-0 right-0 hidden h-[87%] w-[49vw] max-w-[820px] items-end justify-end lg:flex">
          {/* Soft brand glow behind the photo (designed dark-mode treatment) */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 right-0 hidden h-[80%] w-[90%] rounded-full bg-primary/10 blur-3xl dark:block"
          />
          {content.image && (
            <img
              src={content.image}
              alt={content.imageAlt ?? ""}
              className="relative h-full w-full object-cover object-bottom"
              style={{
                // Feather the photo's baked-in white surround into the canvas
                // so it blends in light AND dark mode.
                maskImage:
                  "radial-gradient(160% 145% at 75% 80%, black 64%, transparent 95%)",
                WebkitMaskImage:
                  "radial-gradient(160% 145% at 75% 80%, black 64%, transparent 95%)",
              }}
            />
          )}
          {/* Canvas-colored edge fades that dissolve the photo's white
              surround into the deep-navy canvas: DARK MODE ONLY. In light
              mode the photo's white background already matches the canvas,
              and on short viewports these gradients were hazing the subject's
              face. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 hidden w-[38%] dark:block"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--background)), transparent)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 hidden h-[34%] dark:block"
            style={{
              background:
                "linear-gradient(to bottom, hsl(var(--background)), transparent)",
            }}
          />
        </div>

        {isEditMode && (
          <div
            className="absolute bottom-6 right-6 z-20 h-10 w-10 overflow-hidden rounded-lg"
            style={{ border: "2px solid hsl(var(--primary) / 0.5)" }}
          >
            <EditableImage
              src={content.image || ""}
              alt={content.imageAlt || "Hero photo"}
              onChange={(src) => update("image", src)}
              className="h-full w-full"
              aspectRatio="square"
              placeholder="IMG"
              compact
            />
          </div>
        )}
      </div>

      {/* ── Trusted-by line + institution wordmark bar ── */}
      {(institutions.length > 0 || content.trust || isEditMode) && (
        <div className="qi-logo-bar mt-4 pb-5 pt-1 sm:mt-6 sm:pb-6">
          {(content.trust || isEditMode) && (
            <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-16">
              <p className="qi-trust mb-4 text-sm italic text-muted-foreground/75" style={enter(6)}>
                <EditableText
                  value={content.trust ?? ""}
                  onChange={(v) => update("trust", v)}
                  as="span"
                  placeholder="Trusted by students from"
                />
              </p>
            </div>
          )}

          {isEditMode ? (
            /* Edit mode: static wrap layout so the per-logo controls stay usable. */
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-6 gap-y-4 px-4 sm:gap-x-10 sm:gap-y-5 sm:px-6 lg:justify-start lg:px-16">
              {institutions.map((inst, index) => (
                <div key={inst.id} className="relative flex items-center text-foreground/75">
                  {institutions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstitution(index)}
                      className="absolute -right-2 -top-2 z-20 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      aria-label="Remove institution"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {inst.logo ? (
                    // EditableImage can't render the wordmark itself (its
                    // next/image uses `fill`, which collapses in a w-auto box),
                    // so edit mode keeps the real <img> and floats a compact
                    // change-image control over its corner.
                    <span className="relative inline-flex">
                      <img
                        src={inst.logo}
                        alt={inst.name}
                        loading="lazy"
                        className="qi-logo h-9 w-auto sm:h-12 lg:h-16 dark:opacity-90 dark:hue-rotate-180 dark:invert"
                      />
                      <EditableImage
                        src={inst.logo}
                        alt={inst.name}
                        onChange={(src) => updateInstitution(index, { logo: src })}
                        className="absolute -bottom-2 -right-2 z-10 h-7 w-7 bg-background"
                        aspectRatio="auto"
                        placeholder={inst.name}
                        compact
                      />
                    </span>
                  ) : (
                    // New institution: the dashed box IS the upload action.
                    <EditableImage
                      src=""
                      alt={inst.name}
                      onChange={(src) => updateInstitution(index, { logo: src })}
                      className="h-10 w-28 bg-background"
                      aspectRatio="auto"
                      placeholder="Upload logo"
                      compact
                    />
                  )}
                  <span className="ml-2 max-w-[110px] text-xs text-muted-foreground">
                    <EditableText
                      value={inst.name}
                      onChange={(v) => updateInstitution(index, { name: v })}
                      as="span"
                    />
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={addInstitution}
                className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Institution
              </button>
            </div>
          ) : (
            /* View mode: subtle right-to-left marquee. The sequence renders
               twice so translateX(-50%) loops seamlessly; edges fade into the
               canvas via a mask. */
            <div
              className="relative overflow-hidden"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
              }}
            >
              <div className="qi-marquee flex w-max items-center">
                {[0, 1].map((dup) => (
                  <div
                    key={dup}
                    aria-hidden={dup === 1}
                    className="flex items-center gap-x-14 pl-14 sm:gap-x-24 sm:pl-24"
                  >
                    {institutions.map((inst) => (
                      <div
                        key={`${dup}-${inst.id}`}
                        className="flex shrink-0 items-center text-foreground/75"
                      >
                        {inst.logo ? (
                          // Wordmark images bake near-black ink on transparency;
                          // invert + hue-rotate re-tints them light in dark mode.
                          <img
                            src={inst.logo}
                            alt={dup === 0 ? inst.name : ""}
                            loading="lazy"
                            className="qi-logo h-9 w-auto sm:h-12 lg:h-16 dark:opacity-90 dark:hue-rotate-180 dark:invert"
                          />
                        ) : (
                          <span
                            className="text-lg font-bold tracking-wide sm:text-2xl"
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                          >
                            {inst.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

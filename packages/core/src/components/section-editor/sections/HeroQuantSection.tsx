"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Activity, ArrowRight, BookOpen, Code2, Play, ShieldCheck, Users } from "lucide-react";
import type { CSSProperties, ComponentType } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroQuantSectionProps {
  section: SectionConfig;
}

// ── Deterministic 3D surface (a smooth probability-density hill) ──
// Computed once at module load: a grid sampled from a Gaussian surface and
// projected with a receding perspective (front wide/low, back narrow/high),
// emitted as row + column polylines for the glowing wireframe.
const MESH = (() => {
  const COLS = 18;
  const ROWS = 13;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const surface = (u: number, v: number) => {
    const g = (cu: number, cv: number, su: number, sv: number) =>
      Math.exp(-((((u - cu) / su) ** 2) + (((v - cv) / sv) ** 2)));
    return (
      1 * g(0.64, 0.6, 0.22, 0.36) +
      0.4 * g(0.32, 0.44, 0.24, 0.42) +
      0.14 * g(0.86, 0.34, 0.15, 0.3)
    );
  };
  const pts: { x: number; y: number }[][] = [];
  for (let i = 0; i <= ROWS; i++) {
    const v = i / ROWS; // 0 = front (near), 1 = back (far)
    const centerX = lerp(248, 330, v);
    const width = lerp(474, 300, v);
    const baseY = lerp(272, 150, v);
    const row: { x: number; y: number }[] = [];
    for (let j = 0; j <= COLS; j++) {
      const u = j / COLS;
      row.push({ x: r1(centerX + (u - 0.5) * width), y: r1(baseY - surface(u, v) * 122) });
    }
    pts.push(row);
  }
  const toPath = (arr: { x: number; y: number }[]) =>
    arr.map((p, k) => `${k === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const rows = pts.map((row, i) => ({ d: toPath(row), v: i / ROWS }));
  const cols: string[] = [];
  for (let j = 0; j <= COLS; j++) cols.push(toPath(pts.map((row) => row[j])));
  return { rows, cols };
})();

const STAT_ICONS: ComponentType<{ className?: string; style?: CSSProperties }>[] = [
  BookOpen,
  Users,
  Code2,
  Activity,
];

/**
 * Quant Finance hero, a premium dark, centered hero: teal eyebrow, a white
 * headline with a serif-italic gradient accent, dual CTAs, a trust row, a
 * glowing animated 3D wireframe surface bottom-right, a faint math-formula
 * watermark bottom-left, and an icon stats bar. Theme colors via HSL vars.
 */
export function HeroQuantSection({ section }: HeroQuantSectionProps) {
  const content = section.content as HeroPhotographyContent & { trust?: string };
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();

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
  const enter = (i: number): CSSProperties =>
    isEditMode
      ? {}
      : { animation: "quantFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 0.09}s` };

  return (
    <section className="relative grid min-h-[100svh] items-center overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
      <style>{`
        @keyframes quantFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes quantMeshFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes quantGridDrift { 0% { background-position: 0 0; } 100% { background-position: 44px 44px; } }
        @keyframes quantAuroraA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5%,4%) scale(1.14); } }
        @keyframes quantAuroraB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,-4%) scale(1.1); } }
        @keyframes quantShimmer { to { background-position: 200% center; } }
        @keyframes quantPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.65); } }
        @keyframes quantBreathe { 0%,100% { opacity: 0.16; } 50% { opacity: 0.32; } }
      `}</style>

      {/* Deep navy wash + faint drifting grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 78% 18%, hsl(var(--primary) / 0.14), transparent 60%), radial-gradient(90% 80% at 12% 90%, hsl(var(--accent) / 0.1), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground) / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 100% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(120% 100% at 50% 0%, black, transparent 75%)",
          animation: isEditMode ? undefined : "quantGridDrift 24s linear infinite",
        }}
      />

      {/* Drifting aurora glow orbs for depth */}
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-[34rem] w-[34rem] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 62%)",
          filter: "blur(36px)",
          animation: isEditMode ? undefined : "quantAuroraA 17s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-28 h-[30rem] w-[30rem] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--accent) / 0.2), transparent 62%)",
          filter: "blur(40px)",
          animation: isEditMode ? undefined : "quantAuroraB 21s ease-in-out infinite",
        }}
      />

      {/* 3D wireframe surface (decorative) */}
      <svg
        viewBox="0 0 500 300"
        aria-hidden="true"
        preserveAspectRatio="xMaxYMax meet"
        className="pointer-events-none absolute bottom-0 right-0 hidden h-auto w-[640px] max-w-[58%] md:block"
        style={{ animation: isEditMode ? undefined : "quantMeshFloat 10s ease-in-out infinite" }}
      >
        <defs>
          <filter id="quantGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="quantSoft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>
        {/* soft glow behind the peak */}
        <ellipse
          cx="308"
          cy="152"
          rx="150"
          ry="64"
          fill="hsl(var(--primary))"
          opacity={0.22}
          filter="url(#quantSoft)"
          style={{ animation: isEditMode ? undefined : "quantBreathe 5s ease-in-out infinite" }}
        />
        <g
          filter="url(#quantGlow)"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {MESH.cols.map((d, i) => (
            <path key={`c${i}`} d={d} strokeWidth={0.55} opacity={0.16} />
          ))}
          {MESH.rows.map((r, i) => (
            <path key={`r${i}`} d={r.d} strokeWidth={1.15 - r.v * 0.6} opacity={0.9 - r.v * 0.62} />
          ))}
        </g>
      </svg>

      {/* Math watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-24 left-6 hidden select-none lg:block"
        style={{
          fontFamily: "'Cambria Math', Georgia, serif",
          fontStyle: "italic",
          fontSize: "1.05rem",
          color: "hsl(var(--foreground) / 0.14)",
          letterSpacing: "0.02em",
        }}
      >
        ln(S<sub>T</sub> / S<sub>0</sub>) ~ 𝒩( (μ − ½σ²)T , σ²T )
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
        {/* Eyebrow badge */}
        <span
          className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]"
          style={{
            borderColor: "hsl(var(--accent) / 0.35)",
            backgroundColor: "hsl(var(--accent) / 0.08)",
            color: "hsl(var(--accent))",
            ...enter(0),
          }}
        >
          <span className="relative flex h-2 w-2">
            {!isEditMode && (
              <span
                className="absolute inline-flex h-full w-full rounded-full"
                style={{ backgroundColor: "hsl(var(--accent))", animation: "quantPulse 2s ease-in-out infinite" }}
              />
            )}
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: "hsl(var(--accent))" }}
            />
          </span>
          <EditableText
            value={content.eyebrow ?? "Quant Finance. Taught Practically."}
            onChange={(v) => update("eyebrow", v)}
            as="span"
          />
        </span>

        {/* Headline + serif-italic gradient accent */}
        <h1
          className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
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
        {(content.headlineAccent || isEditMode) && (
          <div className="mt-1 sm:mt-2" style={enter(2)}>
            <span
              className={`text-4xl leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl ${
                isEditMode ? "" : "bg-clip-text text-transparent"
              }`}
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontWeight: 600,
                // The gradient is painted onto the text via background-clip: text
                // (glyphs are transparent). Inside the editor the text lives in a
                // contentEditable node, which breaks the clip and leaves the
                // glyphs invisible, so in edit mode we render a solid accent
                // colour instead (still editable), keeping the gradient shimmer
                // for the live/preview render.
                ...(isEditMode
                  ? { color: "hsl(var(--accent))" }
                  : {
                      backgroundImage:
                        "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--primary)), hsl(var(--accent)))",
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      animation: "quantShimmer 6s linear infinite",
                    }),
              }}
            >
              <EditableText
                value={content.headlineAccent || "Think Like a Quant."}
                onChange={(v) => update("headlineAccent", v)}
                as="span"
                placeholder="Accent line..."
              />
            </span>
          </div>
        )}

        {/* Description */}
        {(content.description || isEditMode) && (
          <p
            className="mt-7 max-w-2xl text-lg leading-relaxed"
            style={{ color: "hsl(var(--muted-foreground))", ...enter(3) }}
          >
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

        {/* CTAs */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={enter(4)}>
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
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-7 py-3.5 text-base font-semibold shadow-lg transition-transform hover:scale-105"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 10px 30px -8px hsl(var(--primary) / 0.6)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                />
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
                  <LinkComponent href={resolveHref(content.primaryCta.href)} className="relative z-10 inline-flex items-center gap-2">
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
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-base font-semibold transition-colors"
                style={{
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  backgroundColor: "hsl(var(--card) / 0.4)",
                }}
              >
                <Play className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
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

        {/* Trust row */}
        <div
          className="mt-7 flex items-center gap-2 text-sm"
          style={{ color: "hsl(var(--muted-foreground))", ...enter(5) }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
          <EditableText
            value={content.trust ?? "Trusted by 5,000+ learners worldwide"}
            onChange={(v) => update("trust", v)}
            as="span"
          />
        </div>

        {/* Stats bar */}
        {stats.length > 0 && (
          <div
            className="relative mt-14 grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-6 rounded-2xl border px-6 py-6 sm:grid-cols-4 sm:gap-x-0"
            style={{
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--card) / 0.55)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 20px 50px -30px hsl(var(--primary) / 0.55)",
              ...enter(6),
            }}
          >
            {/* top accent hairline */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.7), transparent)" }}
            />
            {stats.slice(0, 4).map((stat, i) => {
              const Icon = STAT_ICONS[i] ?? Activity;
              return (
                <div
                  key={stat.id}
                  className={`group flex items-center gap-3 transition-transform duration-300 hover:-translate-y-0.5 sm:justify-center ${i > 0 ? "sm:border-l sm:pl-4" : ""}`}
                  style={i > 0 ? { borderColor: "hsl(var(--border))" } : undefined}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors"
                    style={{ backgroundColor: "hsl(var(--accent) / 0.12)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "hsl(var(--accent))" }} />
                  </span>
                  <div className="min-w-0 text-left">
                    <div className="text-2xl font-extrabold leading-none" style={{ color: "hsl(var(--foreground))" }}>
                      <EditableText
                        value={stat.value}
                        onChange={(v) => {
                          const n = [...stats];
                          n[i] = { ...n[i], value: v };
                          update("stats", n);
                        }}
                        as="span"
                      />
                    </div>
                    <div className="mt-1 truncate text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <EditableText
                        value={stat.label}
                        onChange={(v) => {
                          const n = [...stats];
                          n[i] = { ...n[i], label: v };
                          update("stats", n);
                        }}
                        as="span"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

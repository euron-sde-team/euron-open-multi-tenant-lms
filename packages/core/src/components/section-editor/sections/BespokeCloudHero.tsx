"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Boxes, CheckCircle2, Cloud, Container, Database, GitBranch, Play, Server, Terminal } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke cloud/DevOps hero: split layout with an animated data-flow pipeline.
 *  service nodes wired by glowing edges, packets traveling along the lines, a
 *  "deploy successful" pill and a Build → Test → Deploy stage row. No radar. */
export function BespokeCloudHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps =>
    on
      ? {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {};

  // Pipeline nodes laid out on a 0-100 coordinate grid (percentage based).
  const nodes = [
    { id: "src", x: 8, y: 20, label: "Source", Icon: GitBranch },
    { id: "build", x: 8, y: 78, label: "Build", Icon: Container },
    { id: "registry", x: 48, y: 49, label: "Registry", Icon: Boxes },
    { id: "api", x: 88, y: 18, label: "API", Icon: Server },
    { id: "db", x: 88, y: 78, label: "Database", Icon: Database },
  ] as const;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges: Array<[string, string, number]> = [
    ["src", "registry", 0],
    ["build", "registry", 0.9],
    ["registry", "api", 0.5],
    ["registry", "db", 1.4],
  ];
  const stages = [
    { label: "Build", d: "0s" },
    { label: "Test", d: "0.4s" },
    { label: "Deploy", d: "0.8s" },
  ];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient grid + glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground) / 0.14) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.14) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 90% at 70% 40%, #000 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 70% 40%, #000 40%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-32 top-0 z-0 h-[36rem] w-[36rem] max-w-full rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.22), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -left-24 bottom-0 z-0 h-[28rem] w-[28rem] max-w-full rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-10">
        {/* ── Left: copy ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[13px] font-medium text-foreground/80 backdrop-blur"
          >
            <Cloud className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
            <EditableText
              value={content.eyebrow ?? "Ship with confidence"}
              onChange={(v) => update("eyebrow", v)}
              as="span"
            />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]"
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground lg:mx-0">
              <EditableText
                value={content.description || ""}
                onChange={(v) => update("description", v)}
                as="span"
                placeholder="Add a subtitle..."
              />
            </motion.p>
          )}

          <motion.div
            {...enter(0.24)}
            className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap lg:items-start lg:justify-start"
          >
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
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--accent))] transition-transform hover:scale-[1.04]"
                  style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                        as="span"
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
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <Play className="h-4 w-4" />
                  {isEditMode ? (
                    <EditableText
                      value={content.secondaryCta.text}
                      onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                      as="span"
                    />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>
                      {content.secondaryCta.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </motion.div>

          {stats.length > 0 && (
            <motion.div
              {...enter(0.32)}
              className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start"
            >
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="text-center lg:text-left">
                  <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--accent))" }}>
                    <EditableText
                      value={st.value}
                      onChange={(v) => {
                        const n = [...stats];
                        n[i] = { ...n[i], value: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <EditableText
                      value={st.label}
                      onChange={(v) => {
                        const n = [...stats];
                        n[i] = { ...n[i], label: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Right: animated data-flow pipeline ── */}
        <motion.div
          {...enter(0.2)}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          aria-hidden="true"
        >
          <div className="relative rounded-2xl border border-border bg-card/40 p-5 backdrop-blur-sm">
            {/* Deploy successful pill */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/[0.15] px-3 py-1 text-[12px] font-semibold text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-400/[0.1] dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <EditableLabel value={content.tileLabels?.deployStatus} fallback="Deploy successful" onChange={(v) => update("tileLabels", { ...content.tileLabels, deployStatus: v })} />
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                prod • v2.4.1
              </span>
            </div>

            {/* Node graph */}
            <div className="relative aspect-[4/3] w-full">
              {/* Connecting edges + traveling packets (SVG) */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {edges.map(([from, to], i) => {
                  const a = nodeMap[from];
                  const b = nodeMap[to];
                  return (
                    <line
                      key={`e${i}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="hsl(var(--primary) / 0.35)"
                      strokeWidth={0.6}
                      strokeDasharray="2 2"
                    />
                  );
                })}
              </svg>
              {/* Packets travel along each edge via CSS offset-path */}
              {edges.map(([from, to, delay], i) => {
                const a = nodeMap[from];
                const b = nodeMap[to];
                return (
                  <span
                    key={`p${i}`}
                    className="absolute h-1.5 w-1.5 rounded-full"
                    style={{
                      left: 0,
                      top: 0,
                      backgroundColor: "hsl(var(--accent))",
                      boxShadow: "0 0 8px 2px hsl(var(--accent) / 0.7)",
                      offsetPath: `path('M ${a.x} ${a.y} L ${b.x} ${b.y}')`,
                      offsetDistance: "0%",
                      offsetRotate: "0deg",
                      transform: "translate(-50%, -50%)",
                      animation: on ? `bcldPacket 2.6s ${delay}s linear infinite` : undefined,
                      opacity: on ? undefined : 0,
                    }}
                  />
                );
              })}

              {/* Service nodes */}
              {nodes.map((n, i) => (
                <div
                  key={n.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card"
                    style={{
                      boxShadow: "0 0 0 1px hsl(var(--primary) / 0.2), 0 8px 24px -8px hsl(var(--primary) / 0.5)",
                      animation: on ? `bcldPulse ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` : undefined,
                    }}
                  >
                    <n.Icon className="h-5 w-5" style={{ color: "hsl(var(--accent))" }} />
                  </div>
                  <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{n.label}</span>
                </div>
              ))}
            </div>

            {/* Build → Test → Deploy stage row */}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              {stages.map((s, i) => (
                <div key={s.label} className="flex flex-1 items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/45 bg-emerald-500/[0.16] dark:border-emerald-400/30 dark:bg-emerald-400/[0.12]"
                    style={{ animation: on ? `bcldCheck 3s ${s.d} ease-in-out infinite` : undefined }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                  </span>
                  <span className="text-[11px] font-medium text-foreground/70">{s.label}</span>
                  {i < stages.length - 1 && (
                    <span className="ml-auto h-px flex-1 bg-gradient-to-r from-emerald-500/50 to-transparent dark:from-emerald-400/40" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bcldPacket { 0% { offset-distance: 0%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
        @keyframes bcldPulse { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes bcldCheck { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
      `,
        }}
      />
    </section>
  );
}

"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  RoadmapMindfulnessContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface Props {
  section: SectionConfig;
}

export function RoadmapMindfulnessSection({ section }: Props) {
  const content = section.content as RoadmapMindfulnessContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    LinkComponent,
  } = useSectionEditor();

  const update = (key: keyof RoadmapMindfulnessContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);
  const waypoints = content.waypoints ?? [];
  const desktopPos = getDesktopPositions(waypoints.length);
  const tabletPos = getTabletPositions(waypoints.length);

  return (
    <section
      className={cn(
        "relative overflow-hidden py-14 sm:py-16 md:py-20 lg:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="container-custom relative">
        {/* ── Header ── */}
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12 lg:mb-14">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 sm:mb-5"
            style={{ borderColor: "hsl(var(--primary) / 0.35)", background: "hsl(var(--primary) / 0.12)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "hsl(var(--primary))" }}>
              <EditableLabel value={content.badgeLabel} fallback="Structured Learning" onChange={(v) => update("badgeLabel", v)} />
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4">
            <EditableText
              value={content.headline}
              onChange={(v) => update("headline", v)}
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              as="h2"
              className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
            />
            {(content.headlineAccent || isEditMode) && (
              <span style={{ color: "hsl(var(--primary))" }}>
                <EditableText
                  value={content.headlineAccent ?? ""}
                  onChange={(v) => update("headlineAccent", v)}
                  styleKey="headlineAccent"
                  style={content.textStyles?.headlineAccent}
                  onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                  as="span"
                  className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                  placeholder="Accent..."
                />
              </span>
            )}
          </div>

          {(content.description || isEditMode) && (
            <div className="mt-4 sm:mt-5">
              <EditableText
                value={content.description ?? ""}
                onChange={(v) => update("description", v)}
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                as="p"
                className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
                multiline
                placeholder="Add a description..."
              />
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════
            MOBILE (< 640px): Vertical winding path
           ════════════════════════════════════════════ */}
        <div className="relative mx-auto max-w-xs sm:hidden">
          {/* Vertical SVG path */}
          <svg
            className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2"
            width="80"
            viewBox="0 0 80 600"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rmMobileGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="30%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              </linearGradient>
            </defs>
            <path d={MOBILE_CURVE} stroke="url(#rmMobileGrad)" strokeWidth="28" strokeLinecap="round" />
            <path d={MOBILE_CURVE} stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.35" strokeLinecap="round" />
            {MOBILE_SPARKLES.map((sp, i) => (
              <circle key={i} cx={sp.x} cy={sp.y} r={sp.r} fill="hsl(var(--primary))" opacity={sp.o} />
            ))}
          </svg>

          <div className="relative z-10 flex flex-col items-center" style={{ gap: 40 }}>
            {/* Start marker */}
            <MobileStartMarker />

            {waypoints.map((wp, i) => {
              const isEven = i % 2 === 0;
              return (
                <div
                  key={wp.id}
                  className="flex items-center gap-3"
                  style={{ alignSelf: isEven ? "flex-start" : "flex-end", paddingLeft: isEven ? 8 : 0, paddingRight: isEven ? 0 : 8 }}
                >
                  {isEven ? (
                    <>
                      <WaypointMarker icon={wp.icon} index={i} size="sm" />
                      <WaypointLabel
                        value={wp.label}
                        index={i}
                        waypoints={waypoints}
                        update={update}
                        EditableText={EditableText}
                        align="left"
                        size="sm"
                      />
                    </>
                  ) : (
                    <>
                      <WaypointLabel
                        value={wp.label}
                        index={i}
                        waypoints={waypoints}
                        update={update}
                        EditableText={EditableText}
                        align="right"
                        size="sm"
                      />
                      <WaypointMarker icon={wp.icon} index={i} size="sm" />
                    </>
                  )}
                </div>
              );
            })}

            {/* Goal marker */}
            {(content.goalLabel || isEditMode) && (
              <MobileGoalMarker
                goalLabel={content.goalLabel}
                isEditMode={isEditMode}
                update={update}
                EditableText={EditableText}
              />
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            TABLET (640px – 1023px): Horizontal S-curve, compact
           ════════════════════════════════════════════ */}
        <div className="relative mx-auto hidden max-w-2xl sm:block lg:hidden">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 700 240"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rmTabletGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="20%" stopColor="hsl(var(--primary))" stopOpacity="0.24" />
                <stop offset="80%" stopColor="hsl(var(--primary))" stopOpacity="0.24" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              </linearGradient>
              <filter id="rmTabletGlow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d={TABLET_CURVE} stroke="url(#rmTabletGrad)" strokeWidth="40" strokeLinecap="round" />
            <path d={TABLET_CURVE} stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.38" strokeLinecap="round" />
            {TABLET_SPARKLES.map((sp, i) => (
              <circle key={i} cx={sp.x} cy={sp.y} r={sp.r} fill="hsl(var(--primary))" opacity={sp.o} />
            ))}
          </svg>

          <div className="relative z-10" style={{ minHeight: 240 }}>
            {/* Start pulse */}
            <div
              className="absolute flex flex-col items-center gap-1"
              style={{ left: "3%", top: "50%", transform: "translate(-50%, -50%)" }}
            >
              <div className="relative">
                <div
                  className="absolute -inset-1.5 animate-ping rounded-full opacity-20"
                  style={{ background: "hsl(var(--primary))" }}
                />
                <div
                  className="relative flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: "hsl(var(--primary) / 0.15)", boxShadow: "0 0 10px hsl(var(--primary) / 0.12)" }}
                >
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                </div>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">Start</span>
            </div>

            {/* Tablet waypoints */}
            {waypoints.map((wp, i) => {
              const pos = tabletPos[i] ?? { x: 50, y: 50 };
              return (
                <div
                  key={wp.id}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="relative mb-1">
                    <div
                      className="absolute -inset-2.5 rounded-full opacity-[0.28]"
                      style={{ background: "hsl(var(--primary))" }}
                    />
                    <div
                      className="relative flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-transform duration-300 hover:scale-110 md:h-12 md:w-12"
                      style={{
                        background: "hsl(var(--card))",
                        border: "2px solid hsl(var(--primary) / 0.35)",
                        boxShadow: "0 3px 16px hsl(var(--primary) / 0.22), inset 0 1px 0 hsl(var(--primary) / 0.15)",
                      }}
                    >
                      <WaypointIcon name={wp.icon} size={18} />
                    </div>
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shadow-sm md:h-[18px] md:w-[18px] md:text-[10px]"
                      style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-foreground md:text-xs">
                    <EditableText
                      value={wp.label}
                      onChange={(v) => {
                        const updated = [...waypoints];
                        updated[i] = { ...updated[i], label: v };
                        update("waypoints", updated);
                      }}
                      as="span"
                    />
                  </span>
                </div>
              );
            })}

            {/* Tablet goal */}
            {(content.goalLabel || isEditMode) && (
              <div
                className="absolute flex flex-col items-center"
                style={{ left: "97%", top: "50%", transform: "translate(-50%, -50%)" }}
              >
                <div className="relative mb-1">
                  <div className="absolute -inset-4 rounded-full opacity-[0.22]" style={{ background: "hsl(var(--primary))" }} />
                  <div className="absolute -inset-2.5 rounded-full opacity-[0.18]" style={{ background: "hsl(var(--primary))" }} />
                  <div
                    className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl md:h-16 md:w-16"
                    style={{
                      background: "hsl(var(--primary))",
                      boxShadow: "0 0 0 3px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.2)",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" x2="4" y1="22" y2="15" />
                    </svg>
                  </div>
                </div>
                <span className="whitespace-nowrap text-[11px] font-bold md:text-xs" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText
                    value={content.goalLabel ?? ""}
                    onChange={(v) => update("goalLabel", v)}
                    as="span"
                    placeholder="Goal..."
                  />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            DESKTOP (1024px+): Full S-curve with rich visuals
           ════════════════════════════════════════════ */}
        <div className="relative mx-auto hidden max-w-5xl lg:block">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 900 280"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rmRoad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                <stop offset="20%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                <stop offset="80%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
              </linearGradient>
              <filter id="rmGlow">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d={DESKTOP_CURVE} stroke="url(#rmRoad)" strokeWidth="52" strokeLinecap="round" />
            <path d={DESKTOP_CURVE} stroke="hsl(var(--primary))" strokeWidth="1.8" strokeDasharray="10 8" opacity="0.4" strokeLinecap="round" />
            {DESKTOP_SPARKLES.map((sp, i) => (
              <circle key={i} cx={sp.x} cy={sp.y} r={sp.r} fill="hsl(var(--primary))" opacity={sp.o} />
            ))}
          </svg>

          <div className="relative z-10" style={{ minHeight: 280 }}>
            {/* Start pulse */}
            <div
              className="absolute flex flex-col items-center gap-1.5"
              style={{ left: "3.3%", top: "50%", transform: "translate(-50%, -50%)" }}
            >
              <div className="relative">
                <div
                  className="absolute -inset-2 animate-ping rounded-full opacity-20"
                  style={{ background: "hsl(var(--primary))" }}
                />
                <div
                  className="relative flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "hsl(var(--primary) / 0.15)", boxShadow: "0 0 12px hsl(var(--primary) / 0.15)" }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                </div>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">Start</span>
            </div>

            {/* Desktop waypoints */}
            {waypoints.map((wp, i) => {
              const pos = desktopPos[i] ?? { x: 50, y: 50 };
              return (
                <div
                  key={wp.id}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="relative mb-1.5">
                    <div
                      className="absolute -inset-3 rounded-full opacity-[0.28]"
                      style={{ background: "hsl(var(--primary))" }}
                    />
                    <div
                      className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-300 hover:scale-110"
                      style={{
                        background: "hsl(var(--card))",
                        border: "2px solid hsl(var(--primary) / 0.35)",
                        boxShadow: "0 4px 20px hsl(var(--primary) / 0.22), inset 0 1px 0 hsl(var(--primary) / 0.15)",
                      }}
                    >
                      <WaypointIcon name={wp.icon} />
                    </div>
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm"
                      style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-[13px] font-semibold text-foreground">
                    <EditableText
                      value={wp.label}
                      onChange={(v) => {
                        const updated = [...waypoints];
                        updated[i] = { ...updated[i], label: v };
                        update("waypoints", updated);
                      }}
                      as="span"
                    />
                  </span>
                </div>
              );
            })}

            {/* Desktop goal */}
            {(content.goalLabel || isEditMode) && (
              <div
                className="absolute flex flex-col items-center"
                style={{ left: "96.7%", top: "50%", transform: "translate(-50%, -50%)" }}
              >
                <div className="relative mb-1.5">
                  <div className="absolute -inset-5 rounded-full opacity-[0.24]" style={{ background: "hsl(var(--primary))" }} />
                  <div className="absolute -inset-3 rounded-full opacity-[0.2]" style={{ background: "hsl(var(--primary))" }} />
                  <div
                    className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-xl"
                    style={{
                      background: "hsl(var(--primary))",
                      boxShadow: "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.22)",
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" x2="4" y1="22" y2="15" />
                    </svg>
                  </div>
                </div>
                <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText
                    value={content.goalLabel ?? ""}
                    onChange={(v) => update("goalLabel", v)}
                    as="span"
                    placeholder="Goal..."
                  />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Edit controls ── */}
        {isEditMode && (
          <div className="relative z-10 mt-6 text-center sm:mt-8">
            <button
              className="rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              onClick={() => update("waypoints", [...waypoints, { id: `wp-${Date.now()}`, label: "Step", icon: "compass" }])}
            >
              + Add Waypoint
            </button>
            {waypoints.length > 3 && (
              <button
                className="ml-3 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                onClick={() => update("waypoints", waypoints.slice(0, -1))}
              >
                − Remove Last
              </button>
            )}
          </div>
        )}

        {/* ── CTA ── */}
        {content.primaryCta && !content.primaryCta.hidden && (
          <div className="mt-8 text-center sm:mt-10 lg:mt-12">
            <EditableClickable
              href={content.primaryCta.href}
              onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })}
              hidden={content.primaryCta.hidden}
              onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })}
              isEditing={isEditMode}
              slotLabel="CTA Button"
            >
              <button
                className="inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-base font-bold shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl sm:gap-3 sm:px-10 sm:py-4 sm:text-lg"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 8px 32px hsl(var(--primary) / 0.25)",
                }}
              >
                {isEditMode ? (
                  <EditableText
                    value={content.primaryCta.text}
                    onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                  />
                ) : (
                  <LinkComponent href={content.primaryCta.href} className="inline-flex items-center gap-2.5 sm:gap-3">
                    {content.primaryCta.text}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </LinkComponent>
                )}
              </button>
            </EditableClickable>
          </div>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Sub-components for mobile layout
   ══════════════════════════════════════════════ */

function MobileStartMarker() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div
          className="absolute -inset-1.5 animate-ping rounded-full opacity-20"
          style={{ background: "hsl(var(--primary))" }}
        />
        <div
          className="relative flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: "hsl(var(--primary) / 0.15)", boxShadow: "0 0 10px hsl(var(--primary) / 0.12)" }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">Start</span>
    </div>
  );
}

function MobileGoalMarker({
  goalLabel,
  isEditMode,
  update,
  EditableText,
}: {
  goalLabel: string | undefined;
  isEditMode: boolean;
  update: (key: keyof RoadmapMindfulnessContent, value: unknown) => void;
  EditableText: ReturnType<typeof useSectionEditor>["EditableText"];
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full opacity-[0.24]" style={{ background: "hsl(var(--primary))" }} />
        <div className="absolute -inset-2 rounded-full opacity-[0.2]" style={{ background: "hsl(var(--primary))" }} />
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl"
          style={{
            background: "hsl(var(--primary))",
            boxShadow: "0 0 0 3px hsl(var(--primary) / 0.3), 0 0 24px hsl(var(--primary) / 0.2)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
          </svg>
        </div>
      </div>
      <span className="text-xs font-bold" style={{ color: "hsl(var(--primary))" }}>
        <EditableText
          value={goalLabel ?? ""}
          onChange={(v) => update("goalLabel", v)}
          as="span"
          placeholder="Goal..."
        />
      </span>
    </div>
  );
}

function WaypointMarker({ icon, index, size }: { icon: string; index: number; size: "sm" | "md" }) {
  const dim = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  const iconSize = size === "sm" ? 18 : 20;
  const badgeDim = size === "sm" ? "h-4 w-4 text-[8px]" : "h-[18px] w-[18px] text-[9px]";

  return (
    <div className="relative flex-shrink-0">
      <div
        className="absolute -inset-2 rounded-full opacity-[0.28]"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div
        className={cn("relative flex items-center justify-center rounded-full shadow-md transition-transform duration-300 hover:scale-110", dim)}
        style={{
          background: "hsl(var(--card))",
          border: "2px solid hsl(var(--primary) / 0.35)",
          boxShadow: "0 3px 14px hsl(var(--primary) / 0.22), inset 0 1px 0 hsl(var(--primary) / 0.15)",
        }}
      >
        <WaypointIcon name={icon} size={iconSize} />
      </div>
      <span
        className={cn("absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full font-bold shadow-sm", badgeDim)}
        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
      >
        {index + 1}
      </span>
    </div>
  );
}

function WaypointLabel({
  value,
  index,
  waypoints,
  update,
  EditableText,
  align,
  size,
}: {
  value: string;
  index: number;
  waypoints: RoadmapMindfulnessContent["waypoints"] & object[];
  update: (key: keyof RoadmapMindfulnessContent, value: unknown) => void;
  EditableText: ReturnType<typeof useSectionEditor>["EditableText"];
  align: "left" | "right";
  size: "sm" | "md";
}) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  return (
    <span className={cn("font-semibold text-foreground", textSize, align === "right" && "text-right")}>
      <EditableText
        value={value}
        onChange={(v) => {
          const updated = [...waypoints];
          updated[index] = { ...updated[index], label: v };
          update("waypoints", updated);
        }}
        as="span"
      />
    </span>
  );
}

/* ══════════════════════════════════════════════
   SVG path definitions per breakpoint
   ══════════════════════════════════════════════ */

const DESKTOP_CURVE = "M 30 140 C 150 30, 300 250, 450 140 C 600 30, 750 250, 870 140";

const TABLET_CURVE = "M 25 120 C 120 25, 240 215, 350 120 C 460 25, 580 215, 675 120";

const MOBILE_CURVE = "M 40 10 C 15 80, 65 130, 40 190 C 15 250, 65 310, 40 370 C 15 430, 65 490, 40 560";

/* ── Sparkle dots per layout ── */

const DESKTOP_SPARKLES = [
  { x: 90, y: 105, r: 2.5, o: 0.42 },
  { x: 180, y: 68, r: 1.5, o: 0.35 },
  { x: 240, y: 175, r: 3, o: 0.32 },
  { x: 330, y: 210, r: 2, o: 0.38 },
  { x: 400, y: 155, r: 1.5, o: 0.32 },
  { x: 510, y: 85, r: 2.5, o: 0.38 },
  { x: 570, y: 65, r: 1.5, o: 0.32 },
  { x: 650, y: 160, r: 3, o: 0.35 },
  { x: 720, y: 210, r: 2, o: 0.42 },
  { x: 790, y: 165, r: 1.5, o: 0.32 },
  { x: 140, y: 50, r: 2, o: 0.28 },
  { x: 360, y: 230, r: 2, o: 0.28 },
  { x: 550, y: 50, r: 2, o: 0.28 },
  { x: 760, y: 230, r: 2, o: 0.28 },
];

const TABLET_SPARKLES = [
  { x: 70, y: 88, r: 2, o: 0.38 },
  { x: 145, y: 55, r: 1.5, o: 0.32 },
  { x: 200, y: 150, r: 2.5, o: 0.32 },
  { x: 270, y: 180, r: 1.5, o: 0.35 },
  { x: 320, y: 130, r: 2, o: 0.3 },
  { x: 410, y: 70, r: 2, o: 0.32 },
  { x: 470, y: 55, r: 1.5, o: 0.32 },
  { x: 530, y: 140, r: 2.5, o: 0.32 },
  { x: 590, y: 180, r: 1.5, o: 0.38 },
  { x: 640, y: 140, r: 2, o: 0.3 },
];

const MOBILE_SPARKLES = [
  { x: 25, y: 50, r: 1.5, o: 0.35 },
  { x: 55, y: 110, r: 2, o: 0.32 },
  { x: 20, y: 170, r: 1.5, o: 0.32 },
  { x: 60, y: 230, r: 2, o: 0.3 },
  { x: 22, y: 290, r: 1.5, o: 0.35 },
  { x: 58, y: 350, r: 2, o: 0.32 },
  { x: 25, y: 420, r: 1.5, o: 0.32 },
  { x: 55, y: 490, r: 2, o: 0.3 },
];

/* ══════════════════════════════════════════════
   Bezier math for positioning waypoints on curves
   ══════════════════════════════════════════════ */

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

type Segment = { x: [number, number, number, number]; y: [number, number, number, number] };

function positionsOnCurve(
  segments: Segment[],
  count: number,
  viewW: number,
  viewH: number,
): { x: number; y: number }[] {
  const totalSegments = segments.length;
  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const globalT = count <= 1 ? 0.5 : 0.08 + (i / (count - 1)) * 0.84;
    const scaled = globalT * totalSegments;
    const segIdx = Math.min(Math.floor(scaled), totalSegments - 1);
    const localT = scaled - segIdx;
    const seg = segments[segIdx];
    const px = cubicBezier(localT, seg.x[0], seg.x[1], seg.x[2], seg.x[3]);
    const py = cubicBezier(localT, seg.y[0], seg.y[1], seg.y[2], seg.y[3]);
    positions.push({ x: (px / viewW) * 100, y: (py / viewH) * 100 });
  }
  return positions;
}

function getDesktopPositions(count: number) {
  return positionsOnCurve(
    [
      { x: [30, 150, 300, 450], y: [140, 30, 250, 140] },
      { x: [450, 600, 750, 870], y: [140, 30, 250, 140] },
    ],
    count,
    900,
    280,
  );
}

function getTabletPositions(count: number) {
  return positionsOnCurve(
    [
      { x: [25, 120, 240, 350], y: [120, 25, 215, 120] },
      { x: [350, 460, 580, 675], y: [120, 25, 215, 120] },
    ],
    count,
    700,
    240,
  );
}

/* ══════════════════════════════════════════════
   Waypoint Icon
   ══════════════════════════════════════════════ */

function WaypointIcon({ name, size = 24 }: { name: string; size?: number }) {
  const stroke = "hsl(var(--primary))";
  const icons: Record<string, React.ReactNode> = {
    compass: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
    book: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
    repeat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
    ),
    sprout: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
      </svg>
    ),
    trophy: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
    star: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  };

  return <>{icons[name] || icons.compass}</>;
}

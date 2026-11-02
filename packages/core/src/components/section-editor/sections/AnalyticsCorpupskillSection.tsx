"use client";

import type {
  AnalyticsCorpupskillContent,
  AnalyticsHighlight,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { useSectionEditor } from "../SectionEditorContext";

/** Plotly sample data from design HTML (x / y / marker.color #475569) */
const DEFAULT_CHART_BARS = [
  { name: "Cloud Computing", value: 92 },
  { name: "Leadership", value: 78 },
  { name: "Data Analytics", value: 85 },
  { name: "Cybersecurity", value: 88 },
  { name: "Project Mgmt", value: 76 },
];

const BAR_FILL = "#475569";

/** Shorter X labels so bars stay readable on narrow screens */
const MOBILE_LABEL_ABBR: Record<string, string> = {
  "Cloud Computing": "Cloud",
  Leadership: "Leadership",
  "Data Analytics": "Data",
  Cybersecurity: "Cybersec.",
  "Project Mgmt": "Proj. Mgmt",
};

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

interface AnalyticsCorpupskillSectionProps {
  section: SectionConfig;
}

function useDocumentDarkClass(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function AnalyticsCorpupskillSection({ section }: AnalyticsCorpupskillSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as AnalyticsCorpupskillContent;
  const highlights = content.highlights ?? [];
  const isDark = useDocumentDarkClass();
  const isNarrow = useMatchMedia("(max-width: 640px)");

  const chartData = useMemo(() => {
    const bars = content.chartBars;
    if (bars?.length) {
      return bars.map((b) => ({ name: b.label, value: b.value }));
    }
    return DEFAULT_CHART_BARS;
  }, [content.chartBars]);

  const chartDataDisplay = useMemo(() => {
    if (!isNarrow) return chartData;
    return chartData.map((d) => ({
      ...d,
      name: MOBILE_LABEL_ABBR[d.name] ?? (d.name.length > 11 ? `${d.name.slice(0, 10)}…` : d.name),
    }));
  }, [chartData, isNarrow]);

  const axisColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const cardBg = isDark ? "#1a1a1a" : "#ffffff";

  const handleContentUpdate = (key: keyof AnalyticsCorpupskillContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleHighlightUpdate = (index: number, updates: Partial<AnalyticsHighlight>) => {
    const newItems = [...highlights];
    newItems[index] = { ...newItems[index], ...updates };
    handleContentUpdate("highlights", newItems);
  };

  const addHighlight = () => {
    handleContentUpdate("highlights", [
      ...highlights,
      { id: `hl-${Date.now()}`, icon: "star", title: "New Highlight", description: "Description here" },
    ]);
  };

  const removeHighlight = (index: number) => {
    if (highlights.length <= 1) return;
    handleContentUpdate("highlights", highlights.filter((_: AnalyticsHighlight, i: number) => i !== index));
  };

  return (
    <section className="relative overflow-hidden bg-neutral-900 py-20 text-white dark:bg-black sm:py-24 md:py-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(100, 116, 139, 0.2) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
        {/* Mobile: stacked. lg: stretch row so chart card grows to match text column height (bottoms align). */}
        <div className="grid items-start gap-12 lg:grid-cols-5 lg:items-stretch lg:gap-16">
          <div className="text-center lg:col-span-2 lg:text-left">
            {(content.badge || isEditMode) && (
              <div className="mb-6 flex justify-center sm:mb-8 lg:justify-start">
                <div className="inline-block bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                  <EditableText
                    value={content.badge || ""}
                    onChange={(v) => handleContentUpdate("badge", v)}
                    as="span"
                    placeholder="Badge text..."
                  />
                </div>
              </div>
            )}

            <h2 className="mb-6 text-3xl font-black leading-tight sm:mb-8 sm:text-4xl lg:text-5xl xl:text-6xl">
              <EditableText
                value={content.headline}
                onChange={(v) => handleContentUpdate("headline", v)}
                as="span"
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
              />
            </h2>

            {(content.description || isEditMode) && (
              <p className="mx-auto mb-8 max-w-xl text-base text-neutral-400 sm:mb-12 sm:text-lg lg:mx-0 lg:text-xl">
                <EditableText
                  value={content.description || ""}
                  onChange={(v) => handleContentUpdate("description", v)}
                  as="span"
                  placeholder="Add a description..."
                  multiline
                />
              </p>
            )}

            <div className="mx-auto max-w-md space-y-6 text-left sm:space-y-8 lg:mx-0 lg:max-w-none">
              {highlights.map((hl, index) => {
                const iconName = (hl.icon || "star")
                  .split("-")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join("") as keyof typeof LucideIcons;
                const IconComp =
                  (LucideIcons[iconName] as ComponentType<{ className?: string }>) || LucideIcons.Star;

                return (
                  <div key={hl.id} className="relative">
                    {isEditMode && highlights.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHighlight(index)}
                        className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    <div className="mb-3 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center bg-slate-700 text-white sm:h-12 sm:w-12">
                        <IconComp className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <h4 className="text-lg font-bold sm:text-xl">
                        <EditableText
                          value={hl.title}
                          onChange={(v) => handleHighlightUpdate(index, { title: v })}
                          as="span"
                        />
                      </h4>
                    </div>
                    <p className="pl-14 text-sm text-neutral-400 sm:pl-16">
                      <EditableText
                        value={hl.description}
                        onChange={(v) => handleHighlightUpdate(index, { description: v })}
                        as="span"
                      />
                    </p>
                  </div>
                );
              })}
              {isEditMode && (
                <button
                  type="button"
                  onClick={addHighlight}
                  className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition-colors hover:text-white"
                >
                  <Plus className="h-4 w-4" /> Add Highlight
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col lg:col-span-3 lg:h-full">
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl px-3 py-3 shadow-2xl sm:px-5 sm:py-4"
              style={{ background: cardBg, color: isDark ? "#fff" : "#111827" }}
            >
              <div className="mb-2 shrink-0 sm:mb-3">
                <h4 className="mb-0.5 text-lg font-bold sm:text-xl">Your Skill Development</h4>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  <EditableText
                    value={content.chartCardSubtitle ?? "Current Progress - Q4 2024"}
                    onChange={(v) => handleContentUpdate("chartCardSubtitle", v)}
                    as="span"
                    placeholder="Subtitle..."
                  />
                </p>
              </div>

              {isNarrow && (
                <p className="mb-0.5 shrink-0 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Progress %
                </p>
              )}

              {/* Stacked/mobile: fixed aspect. lg+: flex-1 fills card so bottom aligns with left column. */}
              <div
                id="skills-chart"
                className="w-full min-h-0 min-w-0 shrink-0 aspect-[5/2.85] max-sm:max-h-[13.5rem] sm:aspect-auto sm:h-[17rem] md:h-[18rem] lg:h-auto lg:min-h-[12rem] lg:flex-1"
              >
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <BarChart
                    key={isNarrow ? "narrow" : "wide"}
                    data={isNarrow ? chartDataDisplay : chartData}
                    margin={
                      isNarrow
                        ? { top: 2, right: 4, bottom: 18, left: 2 }
                        : { top: 6, right: 10, bottom: 22, left: 36 }
                    }
                    barCategoryGap={isNarrow ? "18%" : "18%"}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: axisColor, fontSize: isNarrow ? 10 : 11 }}
                      interval={0}
                      angle={isNarrow ? -32 : -18}
                      textAnchor="end"
                      height={isNarrow ? 36 : 50}
                      tickMargin={isNarrow ? 3 : 5}
                    />
                    <YAxis
                      domain={[0, 100]}
                      width={isNarrow ? 30 : 44}
                      tick={{ fill: axisColor, fontSize: isNarrow ? 10 : 12 }}
                      tickCount={5}
                      label={
                        isNarrow
                          ? undefined
                          : {
                              value: "Progress %",
                              angle: -90,
                              position: "insideLeft",
                              fill: axisColor,
                              style: { textAnchor: "middle", fontSize: 11 },
                              offset: 8,
                            }
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill={BAR_FILL}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={isNarrow ? 34 : 48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

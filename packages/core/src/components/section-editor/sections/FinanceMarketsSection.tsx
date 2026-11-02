"use client";

import type {
  FinanceMarketsContent,
  FinanceMarketsStat,
  FinanceMarketsTicker,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowDownRight, ArrowUpRight, LineChart, Plus, Trash2 } from "lucide-react";
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

export function FinanceMarketsSection({ section }: { section: SectionConfig }) {
  const content = section.content as FinanceMarketsContent;
  const { isEditMode, updateSectionContent, EditableText } = useSectionEditor();
  const tickers = content.tickers ?? [];
  const stats = content.stats ?? [];
  const { ref, inView } = useInView<HTMLDivElement>();

  const update = (key: keyof FinanceMarketsContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const updateTicker = (i: number, patch: Partial<FinanceMarketsTicker>) => {
    const next = [...tickers];
    next[i] = { ...next[i], ...patch };
    update("tickers", next);
  };
  const removeTicker = (i: number) => update("tickers", tickers.filter((_, idx) => idx !== i));
  const addTicker = () => update("tickers", [...tickers, { id: `tk-${Date.now()}`, symbol: "NEW", name: "New Asset", price: "0.00", change: "+0.0%", up: true }]);

  const updateStat = (i: number, patch: Partial<FinanceMarketsStat>) => {
    const next = [...stats];
    next[i] = { ...next[i], ...patch };
    update("stats", next);
  };

  return (
    <section ref={ref} className="relative overflow-hidden py-16 sm:py-24" style={{ background: "linear-gradient(180deg, hsl(var(--background)), hsl(var(--muted) / 0.4))" }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(90% 90% at 50% 0%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(90% 90% at 50% 0%, black, transparent 75%)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
            <LineChart className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Live Markets"} onChange={(v) => update("eyebrow", v)} as="span" />
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

        {/* Ticker board */}
        <div className="mt-12 overflow-hidden rounded-2xl shadow-xl" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          {tickers.map((t, i) => {
            const up = t.up;
            const col = up ? "#16a34a" : "#dc2626";
            return (
              <div
                key={t.id}
                className="group relative flex items-center justify-between gap-4 px-5 py-4"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid hsl(var(--border))",
                  transform: inView || isEditMode ? "translateX(0)" : "translateX(-16px)",
                  opacity: inView || isEditMode ? 1 : 0,
                  transition: "transform 0.5s ease, opacity 0.5s ease",
                  transitionDelay: `${i * 0.06}s`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-12 items-center justify-center rounded-md text-xs font-black" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                    <EditableText value={t.symbol} onChange={(v) => updateTicker(i, { symbol: v })} as="span" />
                  </span>
                  <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                    <EditableText value={t.name} onChange={(v) => updateTicker(i, { name: v })} as="span" />
                  </span>
                </div>
                {/* Mini sparkline */}
                <svg className="hidden h-8 w-28 sm:block" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
                  <polyline
                    points={up ? "0,26 20,20 40,22 60,12 80,14 100,4" : "0,6 20,12 40,10 60,20 80,16 100,26"}
                    fill="none"
                    stroke={col}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="140"
                    strokeDashoffset={inView || isEditMode ? 0 : 140}
                    style={{ transition: "stroke-dashoffset 1s ease", transitionDelay: `${i * 0.06 + 0.2}s` }}
                  />
                </svg>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums" style={{ color: "hsl(var(--foreground))" }}>
                    <EditableText value={t.price} onChange={(v) => updateTicker(i, { price: v })} as="span" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${col}1a`, color: col }}>
                    {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    <EditableText value={t.change} onChange={(v) => updateTicker(i, { change: v })} as="span" />
                  </span>
                  {isEditMode && (
                    <>
                      <button type="button" onClick={() => updateTicker(i, { up: !t.up })} className="rounded-md border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                        {up ? "▲" : "▼"}
                      </button>
                      <button type="button" onClick={() => removeTicker(i)} className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white" aria-label="Remove">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {isEditMode && (
            <button type="button" onClick={addTicker} className="flex w-full items-center justify-center gap-2 border-t py-3 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              <Plus className="h-4 w-4" />
              Add Ticker
            </button>
          )}
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((st, i) => (
              <div key={st.id} className="text-center">
                <div className="text-3xl font-extrabold sm:text-4xl" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText value={st.value} onChange={(v) => updateStat(i, { value: v })} as="span" />
                </div>
                <div className="mt-1 text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText value={st.label} onChange={(v) => updateStat(i, { label: v })} as="span" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

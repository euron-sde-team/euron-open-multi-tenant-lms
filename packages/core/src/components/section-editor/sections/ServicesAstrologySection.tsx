"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  ServicesAstrologyContent,
  ServicesAstrologyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Compass, Moon, Plus, Star, Sun, Trash2 } from "lucide-react";
import React from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon,
  star: Star,
  sun: Sun,
  compass: Compass,
};

/* ── Small star cluster decoration per card ── */
function StarCluster({ seed }: { seed: number }) {
  const stars = React.useMemo(() => {
    let s = seed;
    const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
    return Array.from({ length: 5 }, () => ({
      x: rand() * 100,
      y: rand() * 30,
      r: rand() * 1.2 + 0.4,
      o: rand() * 0.15 + 0.05,
    }));
  }, [seed]);

  return (
    <svg className="absolute right-2 top-2 h-12 w-20 opacity-60" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg">
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="hsl(var(--primary))" opacity={s.o} />
      ))}
    </svg>
  );
}

interface ServicesAstrologySectionProps {
  section: SectionConfig;
}

export function ServicesAstrologySection({ section }: ServicesAstrologySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as ServicesAstrologyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof ServicesAstrologyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const services = content.services ?? [];

  const handleServiceUpdate = (index: number, updates: Partial<ServicesAstrologyItem>) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], ...updates };
    handleContentUpdate("services", newServices);
  };

  const addService = () => {
    handleContentUpdate("services", [
      ...services,
      { id: `svc-${Date.now()}`, icon: "star", title: "New Service", description: "Service description" },
    ]);
  };

  const removeService = (index: number) => {
    if (services.length <= 1) return;
    handleContentUpdate("services", services.filter((_: ServicesAstrologyItem, i: number) => i !== index));
  };

  return (
    <section
      id="services-astrology"
      className={cn(
        "relative py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Central ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-8 text-center sm:mb-10">
          <h2
            className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
          >
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
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a subtitle..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}
        </div>

        {/* Service grid, 2x2 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          {services.map((service, index) => {
            const IconComp = iconMap[service.icon || "star"] || Star;
            return (
              <div
                key={service.id}
                className="group relative overflow-hidden rounded-3xl p-7 text-center transition-all duration-400 hover:-translate-y-1 sm:p-9"
                style={{
                  background: `linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)) 80%, hsl(var(--primary) / 0.03) 100%)`,
                  border: "1px solid hsl(var(--primary) / 0.1)",
                  boxShadow: "0 4px 20px hsl(var(--primary) / 0.04)",
                }}
              >
                {/* Star cluster decoration */}
                <StarCluster seed={(index + 1) * 7777} />

                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {/* Icon in glowing circle */}
                <div
                  className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-105"
                  style={{
                    height: "72px",
                    width: "72px",
                    backgroundColor: "hsl(var(--primary) / 0.08)",
                    border: "1px solid hsl(var(--primary) / 0.18)",
                    boxShadow: "0 0 20px hsl(var(--primary) / 0.08), 0 0 40px hsl(var(--primary) / 0.04)",
                  }}
                >
                  <IconComp className="h-8 w-8 text-primary" />
                </div>

                <h3
                  className="mb-3 text-xl font-semibold sm:text-2xl"
                  style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                >
                  <EditableText
                    value={service.title}
                    onChange={(v) => handleServiceUpdate(index, { title: v })}
                    as="span"
                  />
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  <EditableText
                    value={service.description}
                    onChange={(v) => handleServiceUpdate(index, { description: v })}
                    as="span"
                  />
                </p>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addService} className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Add Service
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { Card } from "@open-mtlms/core";
import type { ThemePreset } from "@open-mtlms/shared";
import { getAllThemePresets } from "@open-mtlms/ui-config";
import { Check } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface StepThemeProps {
  selectedThemePresetId: string | null;
  onSelectTheme: (presetId: string) => void;
}

export function StepTheme({ selectedThemePresetId, onSelectTheme }: StepThemeProps) {
  const presets = useMemo(() => getAllThemePresets(), []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Choose Your Theme</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Select a color palette for your website. This applies to all pages.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset) => (
          <ThemeCard
            key={preset.id}
            preset={preset}
            isSelected={selectedThemePresetId === preset.id}
            onSelect={() => onSelectTheme(preset.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  preset,
  isSelected,
  onSelect,
}: {
  preset: ThemePreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "group relative cursor-pointer p-4 transition-all hover:shadow-md",
        isSelected && "ring-primary ring-2",
      )}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="bg-primary absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full">
          <Check className="text-primary-foreground h-3 w-3" />
        </div>
      )}

      {/* Color swatches */}
      <div className="mb-3 flex gap-1.5">
        <div
          className="h-8 w-8 rounded-full border"
          style={{ backgroundColor: preset.preview.primary }}
          title="Primary"
        />
        <div
          className="h-8 w-8 rounded-full border"
          style={{ backgroundColor: preset.preview.secondary }}
          title="Secondary"
        />
        <div
          className="h-8 w-8 rounded-full border"
          style={{ backgroundColor: preset.preview.accent }}
          title="Accent"
        />
      </div>

      <h3 className="text-sm font-semibold">{preset.name}</h3>
      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{preset.description}</p>
    </Card>
  );
}

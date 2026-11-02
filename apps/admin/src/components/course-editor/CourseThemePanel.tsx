"use client";

import { Button, ScrollArea , cn } from "@open-mtlms/core";
import { getAllCourseThemePresets } from "@open-mtlms/ui-config";
import { X, Check } from "lucide-react";

import { useCourseStore } from "@/lib/stores/course-store";

export function CourseThemePanel() {
  const { isThemePanelOpen, closePanels, selectedThemeId, setTheme } = useCourseStore();
  const themePresets = getAllCourseThemePresets();

  if (!isThemePanelOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-full border-l bg-background shadow-lg transition-transform duration-300 ease-in-out md:w-80 lg:w-96",
        isThemePanelOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold">Course Theme</h2>
          <p className="text-sm text-muted-foreground">
            Choose a color theme for your course
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={closePanels}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Theme Presets */}
      <ScrollArea className="h-[calc(100%-5rem)]">
        <div className="grid gap-3 p-4">
          {themePresets.map((preset) => {
            const isSelected = selectedThemeId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setTheme(preset.id)}
                className={cn(
                  "relative flex flex-col items-start rounded-lg border p-4 text-left transition-all",
                  isSelected
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                {/* Color Preview */}
                <div className="mb-3 flex gap-1.5">
                  <div
                    className="h-8 w-8 rounded-full border shadow-sm"
                    style={{ backgroundColor: preset.preview.primary }}
                    title="Primary"
                  />
                  <div
                    className="h-8 w-8 rounded-full border shadow-sm"
                    style={{ backgroundColor: preset.preview.secondary }}
                    title="Secondary"
                  />
                  <div
                    className="h-8 w-8 rounded-full border shadow-sm"
                    style={{ backgroundColor: preset.preview.accent }}
                    title="Accent"
                  />
                </div>

                {/* Theme Info */}
                <div className="flex items-center gap-2">
                  <span className="font-medium">{preset.name}</span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preset.description}
                </p>

                {/* Gradient preview bar */}
                <div
                  className="mt-3 h-2 w-full rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${preset.preview.primary}, ${preset.preview.accent})`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

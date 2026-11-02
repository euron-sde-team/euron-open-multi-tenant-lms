"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";

/**
 * ThemeApplier component
 * Dynamically applies theme CSS variables from the editor store to the document root
 * This enables real-time theme preview when users change colors, fonts, spacing, etc.
 */
export function ThemeApplier() {
  const { pageConfig } = useEditorStore();
  const theme = pageConfig.theme;

  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");

    // Apply color variables
    const colors = isDark && theme.colors.dark 
      ? { ...theme.colors.light, ...theme.colors.dark }
      : theme.colors.light;

    // Set color CSS variables
    Object.entries(colors).forEach(([key, value]) => {
      // Convert camelCase to kebab-case for CSS variable names
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      root.style.setProperty(`--${cssKey}`, value);
    });

    // Apply font variables
    if (theme.fonts) {
      root.style.setProperty("--font-heading", `"${theme.fonts.heading}", system-ui, sans-serif`);
      root.style.setProperty("--font-body", `"${theme.fonts.body}", system-ui, sans-serif`);
    }

    // Apply spacing variables
    if (theme.spacing) {
      root.style.setProperty("--section-padding-y", theme.spacing.sectionPaddingY);
      root.style.setProperty("--section-padding-x", theme.spacing.sectionPaddingX);
      root.style.setProperty("--container-max-width", theme.spacing.containerMaxWidth);
      root.style.setProperty("--gap", theme.spacing.gap);
      root.style.setProperty("--gap-lg", theme.spacing.gapLg);
    }

    // Apply border radius variables
    if (theme.borders) {
      root.style.setProperty("--radius", theme.borders.radius);
      root.style.setProperty("--radius-sm", theme.borders.radiusSm);
      root.style.setProperty("--radius-md", theme.borders.radiusMd);
      root.style.setProperty("--radius-lg", theme.borders.radiusLg);
    }

    // Log for development
    console.log("Theme applied:", theme.name || theme.id);
  }, [theme]);

  // Also listen for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const root = document.documentElement;
          const isDark = root.classList.contains("dark");
          
          // Re-apply colors based on mode
          const colors = isDark && theme.colors.dark 
            ? { ...theme.colors.light, ...theme.colors.dark }
            : theme.colors.light;

          Object.entries(colors).forEach(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            root.style.setProperty(`--${cssKey}`, value);
          });
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [theme]);

  return null;
}

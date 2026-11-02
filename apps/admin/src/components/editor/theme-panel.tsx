"use client";

import {
  Button,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@open-mtlms/core";
import { AVAILABLE_FONTS } from "@open-mtlms/shared";
import { defaultDarkColors, themePresets } from "@open-mtlms/ui-config";
import {
  Check,
  Circle,
  Copy,
  Maximize,
  Palette,
  RotateCcw,
  Type,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

// Color input component with both picker and text input
interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  const [hexValue, setHexValue] = useState(() => hslToHex(value));
  const { toast } = useToast();

  // Update hex when HSL value changes externally
  const displayHex = hslToHex(value);

  const handleHexChange = (hex: string) => {
    setHexValue(hex);
    // Only update if valid hex
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hexToHsl(hex));
    }
  };

  const handleColorPickerChange = (hex: string) => {
    setHexValue(hex);
    onChange(hexToHsl(hex));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(displayHex);
    toast({
      title: "Copied!",
      description: `${displayHex} copied to clipboard`,
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {description && (
          <span className="text-[10px] text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Color picker */}
        <div className="relative">
          <input
            type="color"
            value={displayHex}
            onChange={(e) => handleColorPickerChange(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
          />
        </div>
        {/* Hex input */}
        <Input
          type="text"
          value={hexValue}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={() => setHexValue(displayHex)}
          placeholder="#000000"
          className="flex-1 font-mono text-sm uppercase"
          maxLength={7}
        />
        {/* Copy button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={copyToClipboard}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Helper to convert HSL string to hex for color input
function hslToHex(hsl: string): string {
  // Parse HSL values (format: "221.2 83.2% 53.3%")
  const parts = hsl.split(" ");
  if (parts.length !== 3) return "#3b82f6";

  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper to convert hex to HSL string
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "221.2 83.2% 53.3%";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

interface ThemePanelProps {
  /** When true, edits homepage theme (pageConfig). When false, edits global theme (applies site-wide). */
  isHomePage?: boolean;
}

export function ThemePanel({ isHomePage = true }: ThemePanelProps) {
  const {
    pageConfig,
    globalTheme,
    updateTheme,
    updateGlobalTheme,
    setThemePreset,
    setThemePresetGlobal,
  } = useEditorStore();
  const { toast } = useToast();

  const currentTheme = isHomePage
    ? pageConfig.theme
    : (globalTheme ?? pageConfig.theme);

  const update = isHomePage ? updateTheme : updateGlobalTheme;
  const setPreset = isHomePage ? setThemePreset : setThemePresetGlobal;

  // Load all available Google Fonts so dropdown items render in their actual font,
  // plus ensure the currently selected heading/body fonts are loaded for the preview.
  useEffect(() => {
    const linkId = "theme-panel-google-fonts";
    const families = AVAILABLE_FONTS.map(
      (f) => `family=${f.family.replace(/\s+/g, "+")}:wght@400;500;600;700`
    ).join("&");
    const url = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = linkId;
      linkEl.rel = "stylesheet";
      linkEl.href = url;
      document.head.appendChild(linkEl);
    }

    return () => {
      linkEl?.remove();
    };
  }, []);

  const handleColorChange = (colorKey: string, hslValue: string) => {
    update({
      colors: {
        ...currentTheme.colors,
        light: {
          ...currentTheme.colors.light,
          [colorKey]: hslValue,
        },
      },
    });
  };

  const handleDarkColorChange = (colorKey: string, hslValue: string) => {
    update({
      colors: {
        ...currentTheme.colors,
        dark: {
          ...currentTheme.colors.dark,
          [colorKey]: hslValue,
        },
      },
    });
  };

  const handleSpacingChange = (spacingKey: string, value: string) => {
    update({
      spacing: {
        ...currentTheme.spacing,
        [spacingKey]: value,
      },
    });
  };

  const handleBorderRadiusChange = (radiusKey: string, value: string) => {
    update({
      borders: {
        ...currentTheme.borders,
        [radiusKey]: value,
      },
    });
  };

  const handlePresetSelect = (preset: (typeof themePresets)[0]) => {
    setPreset(preset.config);
    toast({
      title: "Theme Applied",
      description: `${preset.name} theme has been applied. Custom text styles and section backgrounds have been reset.`,
    });
  };

  const resetToDefault = () => {
    const defaultPreset =
      themePresets.find((p) => p.id === "ocean-blue") || themePresets[0];
    setPreset(defaultPreset.config);
    toast({
      title: "Theme Reset",
      description: "Theme has been reset to default. Custom text styles and section backgrounds have been cleared.",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Reset Button */}
      <div className="flex items-center justify-end border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefault}
          className="gap-2"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="presets" className="w-full">
          <TabsList className="mx-4 mt-4 grid w-[calc(100%-2rem)] grid-cols-4">
            <TabsTrigger value="presets" className="text-xs">
              <Palette className="mr-1 h-3 w-3" />
              Presets
            </TabsTrigger>
            <TabsTrigger value="colors" className="text-xs">
              <Circle className="mr-1 h-3 w-3" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="fonts" className="text-xs">
              <Type className="mr-1 h-3 w-3" />
              Fonts
            </TabsTrigger>
            <TabsTrigger value="spacing" className="text-xs">
              <Maximize className="mr-1 h-3 w-3" />
              Spacing
            </TabsTrigger>
          </TabsList>

          {/* Presets Tab */}
          <TabsContent value="presets" className="p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Choose a preset theme or customize colors in the Colors tab
            </p>
            <div className="grid grid-cols-2 gap-3">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={cn(
                    "group relative flex flex-col items-start rounded-lg border p-3 text-left transition-all hover:border-primary hover:shadow-md",
                    currentTheme.id === preset.id &&
                      "border-primary bg-primary/5 ring-2 ring-primary/20"
                  )}
                >
                  {/* Color Preview */}
                  <div className="mb-2 flex gap-1">
                    <div
                      className="h-6 w-6 rounded-full border shadow-sm"
                      style={{ backgroundColor: preset.preview.primary }}
                    />
                    <div
                      className="h-6 w-6 rounded-full border shadow-sm"
                      style={{ backgroundColor: preset.preview.secondary }}
                    />
                    <div
                      className="h-6 w-6 rounded-full border shadow-sm"
                      style={{ backgroundColor: preset.preview.accent }}
                    />
                  </div>
                  <span className="text-sm font-medium">{preset.name}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                  {currentTheme.id === preset.id && (
                    <div className="absolute right-2 top-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6 p-4">
            {/* Light Mode Colors */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <span className="h-3 w-3 rounded-full border bg-white"></span>
                Light Mode Colors
              </h3>
              <div className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Buttons & Links
                </p>
                <ColorInput
                  label="Primary"
                  value={currentTheme.colors.light.primary}
                  onChange={(v) => handleColorChange("primary", v)}
                  description="Primary buttons"
                />
                <ColorInput
                  label="Primary Foreground"
                  value={currentTheme.colors.light.primaryForeground}
                  onChange={(v) => handleColorChange("primaryForeground", v)}
                  description="Text on primary buttons"
                />
                <ColorInput
                  label="Secondary"
                  value={currentTheme.colors.light.secondary}
                  onChange={(v) => handleColorChange("secondary", v)}
                  description="Secondary buttons"
                />
                <ColorInput
                  label="Secondary Foreground"
                  value={currentTheme.colors.light.secondaryForeground}
                  onChange={(v) => handleColorChange("secondaryForeground", v)}
                  description="Text on secondary elements"
                />
                <ColorInput
                  label="Accent"
                  value={currentTheme.colors.light.accent}
                  onChange={(v) => handleColorChange("accent", v)}
                  description="Accent highlights"
                />
                <ColorInput
                  label="Accent Foreground"
                  value={currentTheme.colors.light.accentForeground}
                  onChange={(v) => handleColorChange("accentForeground", v)}
                  description="Text on accent"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  Page & Text
                </p>
                <ColorInput
                  label="Background"
                  value={currentTheme.colors.light.background}
                  onChange={(v) => handleColorChange("background", v)}
                  description="Page background"
                />
                <ColorInput
                  label="Foreground"
                  value={currentTheme.colors.light.foreground}
                  onChange={(v) => handleColorChange("foreground", v)}
                  description="Main text color"
                />
                <ColorInput
                  label="Muted"
                  value={currentTheme.colors.light.muted}
                  onChange={(v) => handleColorChange("muted", v)}
                  description="Subtle backgrounds"
                />
                <ColorInput
                  label="Muted Foreground"
                  value={currentTheme.colors.light.mutedForeground}
                  onChange={(v) => handleColorChange("mutedForeground", v)}
                  description="Muted text"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  Surfaces
                </p>
                <ColorInput
                  label="Card"
                  value={currentTheme.colors.light.card}
                  onChange={(v) => handleColorChange("card", v)}
                  description="Card backgrounds"
                />
                <ColorInput
                  label="Card Foreground"
                  value={currentTheme.colors.light.cardForeground}
                  onChange={(v) => handleColorChange("cardForeground", v)}
                  description="Text on cards"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  UI Elements
                </p>
                <ColorInput
                  label="Border"
                  value={currentTheme.colors.light.border}
                  onChange={(v) => handleColorChange("border", v)}
                  description="Borders & dividers"
                />
                <ColorInput
                  label="Input"
                  value={currentTheme.colors.light.input}
                  onChange={(v) => handleColorChange("input", v)}
                  description="Input backgrounds"
                />
                <ColorInput
                  label="Ring"
                  value={currentTheme.colors.light.ring}
                  onChange={(v) => handleColorChange("ring", v)}
                  description="Focus ring"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  Status Colors
                </p>
                <ColorInput
                  label="Destructive"
                  value={currentTheme.colors.light.destructive}
                  onChange={(v) => handleColorChange("destructive", v)}
                  description="Error/delete buttons"
                />
                <ColorInput
                  label="Destructive Foreground"
                  value={currentTheme.colors.light.destructiveForeground}
                  onChange={(v) => handleColorChange("destructiveForeground", v)}
                  description="Text on destructive"
                />
                <ColorInput
                  label="Success"
                  value={currentTheme.colors.light.success}
                  onChange={(v) => handleColorChange("success", v)}
                  description="Success states"
                />
                <ColorInput
                  label="Success Foreground"
                  value={currentTheme.colors.light.successForeground}
                  onChange={(v) => handleColorChange("successForeground", v)}
                  description="Text on success"
                />
                <ColorInput
                  label="Warning"
                  value={currentTheme.colors.light.warning}
                  onChange={(v) => handleColorChange("warning", v)}
                  description="Warning states"
                />
                <ColorInput
                  label="Warning Foreground"
                  value={currentTheme.colors.light.warningForeground}
                  onChange={(v) => handleColorChange("warningForeground", v)}
                  description="Text on warning"
                />
              </div>
            </div>

            <Separator />

            {/* Dark Mode Colors */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <span className="h-3 w-3 rounded-full border bg-gray-800"></span>
                Dark Mode Colors
              </h3>
              <div className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Buttons & Links
                </p>
                <ColorInput
                  label="Primary"
                  value={currentTheme.colors.dark?.primary ?? currentTheme.colors.light.primary}
                  onChange={(v) => handleDarkColorChange("primary", v)}
                  description="Primary buttons"
                />
                <ColorInput
                  label="Primary Foreground"
                  value={currentTheme.colors.dark?.primaryForeground ?? currentTheme.colors.light.primaryForeground}
                  onChange={(v) => handleDarkColorChange("primaryForeground", v)}
                  description="Text on primary buttons"
                />
                <ColorInput
                  label="Secondary"
                  value={currentTheme.colors.dark?.secondary ?? currentTheme.colors.light.secondary}
                  onChange={(v) => handleDarkColorChange("secondary", v)}
                  description="Secondary buttons"
                />
                <ColorInput
                  label="Secondary Foreground"
                  value={currentTheme.colors.dark?.secondaryForeground ?? currentTheme.colors.light.secondaryForeground}
                  onChange={(v) => handleDarkColorChange("secondaryForeground", v)}
                  description="Text on secondary"
                />
                <ColorInput
                  label="Accent"
                  value={currentTheme.colors.dark?.accent ?? currentTheme.colors.light.accent}
                  onChange={(v) => handleDarkColorChange("accent", v)}
                  description="Accent highlights"
                />
                <ColorInput
                  label="Accent Foreground"
                  value={currentTheme.colors.dark?.accentForeground ?? currentTheme.colors.light.accentForeground}
                  onChange={(v) => handleDarkColorChange("accentForeground", v)}
                  description="Text on accent"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  Page & Text
                </p>
                <ColorInput
                  label="Background"
                  value={currentTheme.colors.dark?.background || defaultDarkColors.background}
                  onChange={(v) => handleDarkColorChange("background", v)}
                  description="Page background"
                />
                <ColorInput
                  label="Foreground"
                  value={currentTheme.colors.dark?.foreground || defaultDarkColors.foreground}
                  onChange={(v) => handleDarkColorChange("foreground", v)}
                  description="Text color"
                />
                <ColorInput
                  label="Muted"
                  value={currentTheme.colors.dark?.muted || defaultDarkColors.muted}
                  onChange={(v) => handleDarkColorChange("muted", v)}
                  description="Subtle backgrounds"
                />
                <ColorInput
                  label="Muted Foreground"
                  value={currentTheme.colors.dark?.mutedForeground || defaultDarkColors.mutedForeground}
                  onChange={(v) => handleDarkColorChange("mutedForeground", v)}
                  description="Muted text"
                />
                <ColorInput
                  label="Card"
                  value={currentTheme.colors.dark?.card || defaultDarkColors.card}
                  onChange={(v) => handleDarkColorChange("card", v)}
                  description="Card backgrounds"
                />
                <ColorInput
                  label="Card Foreground"
                  value={currentTheme.colors.dark?.cardForeground || defaultDarkColors.cardForeground}
                  onChange={(v) => handleDarkColorChange("cardForeground", v)}
                  description="Text on cards"
                />

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">
                  UI Elements
                </p>
                <ColorInput
                  label="Border"
                  value={currentTheme.colors.dark?.border || defaultDarkColors.border}
                  onChange={(v) => handleDarkColorChange("border", v)}
                  description="Borders & dividers"
                />
                <ColorInput
                  label="Input"
                  value={currentTheme.colors.dark?.input || defaultDarkColors.input}
                  onChange={(v) => handleDarkColorChange("input", v)}
                  description="Input backgrounds"
                />
                <ColorInput
                  label="Ring"
                  value={currentTheme.colors.dark?.ring ?? currentTheme.colors.light.ring}
                  onChange={(v) => handleDarkColorChange("ring", v)}
                  description="Focus ring"
                />
              </div>
            </div>

            {/* Live Preview - Light */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Live Preview (Light)
              </p>
              <div className="flex gap-2">
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.light.primary})`,
                    color: `hsl(${currentTheme.colors.light.primaryForeground})`,
                  }}
                >
                  Primary
                </div>
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.light.secondary})`,
                    color: `hsl(${currentTheme.colors.light.secondaryForeground})`,
                  }}
                >
                  Secondary
                </div>
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.light.accent})`,
                    color: `hsl(${currentTheme.colors.light.accentForeground})`,
                  }}
                >
                  Accent
                </div>
              </div>
            </div>

            {/* Live Preview - Dark */}
            <div
              className="rounded-lg border p-4"
              style={{ backgroundColor: `hsl(${currentTheme.colors.dark?.background || defaultDarkColors.background})` }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: `hsl(${currentTheme.colors.dark?.foreground || defaultDarkColors.foreground})` }}>
                Live Preview (Dark)
              </p>
              <div className="flex gap-2">
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.dark?.primary ?? currentTheme.colors.light.primary})`,
                    color: `hsl(${currentTheme.colors.dark?.primaryForeground ?? currentTheme.colors.light.primaryForeground})`,
                  }}
                >
                  Primary
                </div>
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.dark?.secondary ?? currentTheme.colors.light.secondary})`,
                    color: `hsl(${currentTheme.colors.dark?.secondaryForeground ?? currentTheme.colors.light.secondaryForeground})`,
                  }}
                >
                  Secondary
                </div>
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${currentTheme.colors.dark?.accent ?? currentTheme.colors.light.accent})`,
                    color: `hsl(${currentTheme.colors.dark?.accentForeground ?? currentTheme.colors.light.accentForeground})`,
                  }}
                >
                  Accent
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Fonts Tab */}
          <TabsContent value="fonts" className="space-y-4 p-4">
            <div>
              <Label className="text-xs text-muted-foreground">Typography</Label>
              <Select
                value={currentTheme.fonts.body}
                onValueChange={(value) => {
                  update({
                    fonts: {
                      ...currentTheme.fonts,
                      heading: value,
                      body: value,
                    },
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FONTS.filter((f) => f.category !== "monospace").map(
                    (font) => (
                      <SelectItem key={font.family} value={font.family}>
                        <span style={{ fontFamily: font.family }}>
                          {font.family}
                        </span>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="rounded-lg border bg-muted/50 p-4">
              <h4
                className="mb-2 text-lg font-bold"
                style={{
                  fontFamily: `"${currentTheme.fonts.heading}", system-ui, sans-serif`,
                }}
              >
                Preview Heading
              </h4>
              <p
                className="text-sm text-muted-foreground"
                style={{
                  fontFamily: `"${currentTheme.fonts.body}", system-ui, sans-serif`,
                }}
              >
                This is how your body text will look with the selected font. The
                quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </TabsContent>

          {/* Spacing Tab */}
          <TabsContent value="spacing" className="space-y-6 p-4">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Section Padding (Vertical)
                </Label>
                <span className="font-mono text-xs font-medium text-primary">
                  {currentTheme.spacing.sectionPaddingY}
                </span>
              </div>
              <Slider
                value={[parseFloat(currentTheme.spacing.sectionPaddingY)]}
                min={1}
                max={10}
                step={0.5}
                onValueChange={([value]) =>
                  handleSpacingChange("sectionPaddingY", `${value}rem`)
                }
                className="mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Section Padding (Horizontal)
                </Label>
                <span className="font-mono text-xs font-medium text-primary">
                  {currentTheme.spacing.sectionPaddingX}
                </span>
              </div>
              <Slider
                value={[parseFloat(currentTheme.spacing.sectionPaddingX)]}
                min={0.5}
                max={4}
                step={0.25}
                onValueChange={([value]) =>
                  handleSpacingChange("sectionPaddingX", `${value}rem`)
                }
                className="mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Container Max Width
                </Label>
                <span className="font-mono text-xs font-medium text-primary">
                  {currentTheme.spacing.containerMaxWidth}
                </span>
              </div>
              <Slider
                value={[parseInt(currentTheme.spacing.containerMaxWidth)]}
                min={960}
                max={1600}
                step={40}
                onValueChange={([value]) =>
                  handleSpacingChange("containerMaxWidth", `${value}px`)
                }
                className="mt-2"
              />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Border Radius
                </Label>
                <span className="font-mono text-xs font-medium text-primary">
                  {currentTheme.borders.radius}
                </span>
              </div>
              <Slider
                value={[parseFloat(currentTheme.borders.radius)]}
                min={0}
                max={1.5}
                step={0.125}
                onValueChange={([value]) =>
                  handleBorderRadiusChange("radius", `${value}rem`)
                }
                className="mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                  Large Border Radius
                </Label>
                <span className="font-mono text-xs font-medium text-primary">
                  {currentTheme.borders.radiusLg}
                </span>
              </div>
              <Slider
                value={[parseFloat(currentTheme.borders.radiusLg)]}
                min={0}
                max={2}
                step={0.125}
                onValueChange={([value]) =>
                  handleBorderRadiusChange("radiusLg", `${value}rem`)
                }
                className="mt-2"
              />
            </div>

            {/* Preview */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Border Radius Preview
              </p>
              <div className="flex gap-3">
                <div
                  className="h-16 w-16 bg-primary"
                  style={{ borderRadius: currentTheme.borders.radius }}
                />
                <div
                  className="h-16 w-16 bg-primary"
                  style={{ borderRadius: currentTheme.borders.radiusLg }}
                />
                <div
                  className="h-16 flex-1 bg-primary"
                  style={{ borderRadius: currentTheme.borders.radius }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom padding for scroll */}
        <div className="h-8" />
      </ScrollArea>
    </div>
  );
}

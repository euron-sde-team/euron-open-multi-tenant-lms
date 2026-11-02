"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from "@open-mtlms/core";
import type { SectionConfig, SectionType } from "@open-mtlms/shared";
import { SECTION_CATEGORIES } from "@open-mtlms/shared";
import { sectionRegistry } from "@open-mtlms/ui-config";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  LayoutTemplate,
  Lock,
  Monitor,
  Palette,
  PaintBucket,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useEditMode,
  useEditModeContext,
  useIsSectionRestricted,
} from "@/lib/contexts/edit-mode-context";
import { SECTION_AI_CONFIGS } from "@/lib/section-ai-configs";
import { useEditorStore } from "@/lib/stores/editor-store";
import { SectionPhotoLayer, buildSectionPhoto } from "./section-photo-layer";
import { uploadApi } from "@/lib/api/upload";
import { cn } from "@/lib/utils";

import { AiGenerateDialog } from "../editor/ai-generate-dialog";
import { BASIC_SECTION_TEMPLATES } from "../editor/basic-section-templates";
import { SectionPreviewCard } from "../editor/section-preview-card";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

interface SectionWrapperProps {
  section: SectionConfig;
  children: React.ReactNode;
  index: number;
  totalSections: number;
}

/** Map API-driven section types to their "Add" action label and dashboard route */
const SECTION_ADD_ACTIONS: Record<string, { label: string; href: string }> = {
  "all-courses-listing": { label: "Add Courses", href: "/dashboard/courses" },
  "self-paced-courses-listing": { label: "Add Courses", href: "/dashboard/courses" },
  "course-cards": { label: "Add Courses", href: "/dashboard/courses" },
  "books-listing": { label: "Add Books", href: "/dashboard/books" },
  "book-showcase": { label: "Add Books", href: "/dashboard/books" },
  "bundles-listing": { label: "Add Bundles", href: "/dashboard/bundles" },
  "categories-listing": { label: "Add Categories", href: "/dashboard/categories" },
  "testimonials-scroll-code-tech": { label: "Add Testimonials", href: "/dashboard/testimonials" },
  "testimonials-grid": { label: "Add Testimonials", href: "/dashboard/testimonials" },
};

// ---------------------------------------------------------------------------
// Change Style Modal – wide layout with card grid (like All Templates)
// ---------------------------------------------------------------------------
function ChangeStyleModal({
  section,
  open,
  onOpenChange,
}: {
  section: SectionConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { changeSectionVariant, changeSectionType } = useEditorStore();
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  type RegistryEntry = (typeof sectionRegistry)[keyof typeof sectionRegistry];
  type CuratedStyleEntry = {
    type: string;
    entry: RegistryEntry;
    forcedVariant: string;
  };

  // Find the current section's category from sectionRegistry
  const currentEntry = useMemo(
    () => sectionRegistry[section.type as keyof typeof sectionRegistry],
    [section.type]
  );

  // Keep only one curated basic template for the current category.
  const sameCategoryEntries = useMemo<CuratedStyleEntry[]>(() => {
    if (!currentEntry) return [];

    const template = BASIC_SECTION_TEMPLATES.find((t) => t.category === currentEntry.category);
    if (!template) return [];

    const entry = sectionRegistry[template.type as keyof typeof sectionRegistry];
    if (!entry) return [];
    const hasVariant = entry.variants.some((v) => v.id === template.variant);
    if (!hasVariant) return [];

    return [{ type: template.type, entry, forcedVariant: template.variant }];
  }, [currentEntry]);

  const categoryLabel =
    SECTION_CATEGORIES.find((c) => c.id === currentEntry?.category)?.name ?? "Section";

  // Flatten to one curated style item.
  const styleItems = useMemo(() => {
    const items: {
      type: string;
      variant: string;
      sectionName: string;
      sectionDescription: string;
    }[] = [];
    for (const { type, entry, forcedVariant } of sameCategoryEntries) {
      const v = entry.variants.find((variant) => variant.id === forcedVariant);
      if (!v) continue;
      items.push({
        type,
        variant: v.id,
        sectionName: `${entry.name}, ${v.name}`,
        sectionDescription: v.description || entry.description,
      });
    }
    return items;
  }, [sameCategoryEntries]);

  const handleSelect = (type: SectionType, variant: string) => {
    if (type === section.type) {
      if (variant !== section.variant) {
        changeSectionVariant(section.id, variant);
      }
    } else {
      changeSectionType(section.id, type, variant);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="flex h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 shadow-2xl">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Change Style
              </DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Choose a layout or style for this section
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-6">
                {/* Results count + viewport toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {styleItems.length} style
                    {styleItems.length !== 1 ? "s" : ""} in {categoryLabel}
                  </p>

                  <div className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
                    {(
                      [
                        { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
                        { mode: "tablet" as const, icon: Tablet, label: "Tablet" },
                        { mode: "mobile" as const, icon: Smartphone, label: "Mobile" },
                      ] as const
                    ).map(({ mode, icon: Icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                          viewport === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setViewport(mode)}
                        title={label}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style grid */}
                {styleItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <LayoutTemplate className="text-muted-foreground/40 mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">No styles available.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {styleItems.map((item) => {
                      const isActive =
                        item.type === section.type && item.variant === section.variant;
                      return (
                        <SectionPreviewCard
                          key={`${item.type}-${item.variant}`}
                          type={item.type}
                          variant={item.variant}
                          sectionName={item.sectionName}
                          sectionDescription={item.sectionDescription}
                          categoryLabel={categoryLabel}
                          viewport={viewport}
                          showAddIcon={false}
                          isActive={isActive}
                          onClick={() => handleSelect(item.type as SectionType, item.variant)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Section Background Color Modal – hex color picker for light and dark mode
// ---------------------------------------------------------------------------
function SectionBackgroundColorModal({
  section,
  open,
  onOpenChange,
}: {
  section: SectionConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateSection } = useEditorStore();
  const latestSection = useEditorStore((state) =>
    open ? state.pageConfig.sections.find((s) => s.id === section.id) : null
  );
  const effectiveSection = open && latestSection ? latestSection : section;
  const settings = effectiveSection?.settings ?? {};
  const [lightHex, setLightHex] = useState(settings.backgroundColor ?? "");
  const [darkHex, setDarkHex] = useState(settings.backgroundColorDark ?? "");

  useEffect(() => {
    if (open) {
      setLightHex(settings.backgroundColor ?? "");
      setDarkHex(settings.backgroundColorDark ?? "");
    }
  }, [open, settings.backgroundColor, settings.backgroundColorDark]);

  const normalizeHex = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
    if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed}`;
    return trimmed;
  };

  const handleLightChange = (hex: string) => {
    const val = normalizeHex(hex);
    setLightHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || val === "") {
      updateSection(effectiveSection.id, {
        settings: { ...settings, backgroundColor: val || undefined },
      });
    }
  };

  const handleDarkChange = (hex: string) => {
    const val = normalizeHex(hex);
    setDarkHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || val === "") {
      updateSection(effectiveSection.id, {
        settings: { ...settings, backgroundColorDark: val || undefined },
      });
    }
  };

  const handleClear = () => {
    const { backgroundColor: _backgroundColor, backgroundColorDark: _backgroundColorDark, ...rest } = settings;
    updateSection(effectiveSection.id, { settings: rest });
    setLightHex("");
    setDarkHex("");
    onOpenChange(false);
  };

  const displayLight = lightHex.startsWith("#") ? lightHex : lightHex ? `#${lightHex}` : "#ffffff";
  const displayDark = darkHex.startsWith("#") ? darkHex : darkHex ? `#${darkHex}` : "#1f2937";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="max-w-sm gap-4 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Section Background Color</DialogTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Set background for light and dark mode
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Light Mode</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={displayLight}
                onChange={(e) => handleLightChange(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
              />
              <Input
                type="text"
                value={lightHex}
                onChange={(e) => setLightHex(e.target.value)}
                onBlur={(e) => handleLightChange(e.target.value)}
                placeholder="#ffffff"
                className="flex-1 font-mono text-sm uppercase"
                maxLength={7}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Dark Mode</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={displayDark}
                onChange={(e) => handleDarkChange(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
              />
              <Input
                type="text"
                value={darkHex}
                onChange={(e) => setDarkHex(e.target.value)}
                onBlur={(e) => handleDarkChange(e.target.value)}
                placeholder="#1f2937"
                className="flex-1 font-mono text-sm uppercase"
                maxLength={7}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleClear}>
            <RotateCcw className="h-3.5 w-3.5" />
            Clear custom background
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SectionBackgroundWrapper – applies section.settings backgroundColor
// ---------------------------------------------------------------------------
function SectionBackgroundWrapper({
  section,
  children,
  editable = false,
}: {
  section: SectionConfig;
  children: React.ReactNode;
  /** Only the edit-mode wrapper passes true; the preview renders them fixed. */
  editable?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const settings = section.settings ?? {};
  const bgColor = isDark
    ? (settings.backgroundColorDark ?? settings.backgroundColor)
    : settings.backgroundColor;
  const photos = settings.photos ?? [];
  // `relative` is required whenever there are photos: they are positioned
  // against THIS box, and without it they would anchor to whatever ancestor
  // happens to be positioned, landing somewhere else entirely.
  if (!bgColor && photos.length === 0) return <>{children}</>;
  return (
    <div className={photos.length > 0 ? "relative" : undefined} style={bgColor ? { backgroundColor: bgColor } : undefined}>
      {children}
      <SectionPhotoLayer section={section} editable={editable} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// View-mode wrapper: scroll entrance animation (off in edit mode)
// ---------------------------------------------------------------------------
function SectionEntranceWrapper({
  section,
  children,
  isFirstSection,
}: {
  section: SectionConfig;
  children: React.ReactNode;
  isFirstSection?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!!isFirstSection);

  useEffect(() => {
    if (isFirstSection) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFirstSection]);

  return (
    <div
      ref={ref}
      className={cn(
        !isFirstSection && "section-entrance",
        !isFirstSection && visible && "section-entrance-visible"
      )}
    >
      <SectionBackgroundWrapper section={section}>{children}</SectionBackgroundWrapper>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Section Divider – thin line with "+" button between sections
// Clicking + opens the Add Section modal (SectionPanel)
// ---------------------------------------------------------------------------
export function AddSectionDivider({ afterSectionId }: { afterSectionId?: string }) {
  const { openSectionPanel } = useEditorStore();

  return (
    <div className="group/divider relative z-20 flex items-center justify-center py-0">
      {/* The line */}
      <div className="border-primary/0 group-hover/divider:border-primary/30 absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed transition-colors" />

      {/* The + button – opens Add Section modal */}
      <button
        className={cn(
          "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all",
          "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary scale-75 opacity-0 group-hover/divider:scale-100 group-hover/divider:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation();
          openSectionPanel(afterSectionId);
        }}
        title="Add Section"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionWrapper – public export
// ---------------------------------------------------------------------------
export function SectionWrapper({ section, children, index, totalSections }: SectionWrapperProps) {
  const isEditMode = useEditMode();
  const isRestricted = useIsSectionRestricted(section.type);

  // Non-edit mode: scroll entrance animation
  if (!isEditMode) {
    return (
      <SectionEntranceWrapper section={section} isFirstSection={index === 0}>
        {children}
      </SectionEntranceWrapper>
    );
  }

  // For restricted sections (header/footer in course templates), show with a lock indicator but no editing
  if (isRestricted) {
    return (
      <SectionWrapperRestricted section={section}>
        <SectionBackgroundWrapper section={section}>{children}</SectionBackgroundWrapper>
      </SectionWrapperRestricted>
    );
  }

  return (
    <SectionWrapperEditor section={section} index={index} totalSections={totalSections}>
      {children}
    </SectionWrapperEditor>
  );
}

// Component for restricted sections (header/footer in course templates)
// These are completely static - no selection, no hover, no toolbar
function SectionWrapperRestricted({
  section,
  children,
}: {
  section: SectionConfig;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* Lock indicator badge */}
      <div className="absolute right-4 top-4 z-20">
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <Lock className="h-3 w-3" />
          {section.type === "header"
            ? "Header"
            : section.type === "footer"
              ? "Footer"
              : section.type}
          <span className="text-muted-foreground">· Set in Landing Page</span>
        </Badge>
      </div>
      {/* Section content */}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionWrapperEditor – edit-mode toolbar with Change Style button
// ---------------------------------------------------------------------------
function SectionWrapperEditor({ section, children, index, totalSections }: SectionWrapperProps) {
  const {
    selectedSectionId,
    hoveredSectionId,
    selectSection,
    hoverSection,
    moveSection,
    duplicateSection,
    deleteSection,
    toggleSectionVisibility,
    updateSection,
  } = useEditorStore();

  const { isContentEditable, disableDeleteDuplicate } = useEditModeContext();

  const sectionRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedSectionId === section.id;
  const isHovered = hoveredSectionId === section.id;
  const isHidden = !section.visible;
  const isFirst = index === 0;
  const isLast = index === totalSections - 1;

  // When content is not editable (course template mode), only allow rearranging and visibility toggle
  const isTemplateMode = !isContentEditable;

  const [showChangeStyle, setShowChangeStyle] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  /**
   * Upload a photo and drop it onto this section. It lands near the middle at a
   * modest size; the admin then drags it where they want it.
   */
  const handleAddPhoto = useCallback(
    async (file: File) => {
      setAddingPhoto(true);
      try {
        const { url } = await uploadApi.uploadFile(file, "page-images");
        const photos = [...(section.settings?.photos ?? []), buildSectionPhoto(url)];
        updateSection(section.id, { settings: { ...(section.settings ?? {}), photos } });
        toast({ title: "Photo added", description: "Drag it where you want it." });
      } catch {
        toast({
          title: "Could not add the photo",
          description: "Please try again.",
          variant: "destructive",
        });
      } finally {
        setAddingPhoto(false);
      }
    },
    [section.id, section.settings, updateSection, toast]
  );

  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const isAiGeneratable = aiAuthoringEnabled && section.type in SECTION_AI_CONFIGS;

  // Check if "Change Style" has any alternative styles for this section type
  const hasAlternateStyles = useMemo(() => {
    const entry = sectionRegistry[section.type as keyof typeof sectionRegistry];
    if (!entry) return false;
    return BASIC_SECTION_TEMPLATES.some((t) => t.category === entry.category);
  }, [section.type]);

  // Scroll to section when selected
  useEffect(() => {
    if (isSelected && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isSelected]);

  return (
    <div
      ref={sectionRef}
      id={`section-${section.id}`}
      className={cn(
        "edit-mode-section group relative",
        // Use outline instead of ring - outline is never clipped by overflow, ensuring full border visibility
        isSelected && "outline outline-2 outline-offset-2 outline-[hsl(var(--primary))]",
        isHovered && !isSelected && "outline outline-2 outline-offset-2 outline-[hsl(var(--primary)_/_0.5)]",
        isHidden && "opacity-50"
      )}
      onClick={(e) => {
        e.stopPropagation();
        selectSection(section.id);
      }}
      onMouseEnter={() => hoverSection(section.id)}
      onMouseLeave={() => hoverSection(null)}
    >
      {/* Top toolbar - Positioned at top right for better visibility */}
      <div
        className={cn(
          "bg-background/95 absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg border p-1.5 shadow-lg backdrop-blur transition-all",
          "translate-y-2 opacity-0",
          (isSelected || isHovered) && "translate-y-0 opacity-100"
        )}
      >
        {/* Section Label */}
        <span className="text-muted-foreground px-2 text-xs font-medium capitalize">
          {section.type.replace(/-/g, " ")}
        </span>

        {/* Template mode indicator */}
        {isTemplateMode && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            UI Only
          </Badge>
        )}

        <div className="bg-border h-4 w-px" />

        {/* Change Style, only show when alternative styles exist */}
        {!isTemplateMode && hasAlternateStyles && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChangeStyle(true);
                  }}
                >
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Change Style</TooltipContent>
            </Tooltip>
            <ChangeStyleModal
              section={section}
              open={showChangeStyle}
              onOpenChange={setShowChangeStyle}
            />
          </>
        )}

        {/* Section Background Color */}
        {!isTemplateMode && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBgColor(true);
                  }}
                >
                  <PaintBucket className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Section background color</TooltipContent>
            </Tooltip>
            <SectionBackgroundColorModal
              section={section}
              open={showBgColor}
              onOpenChange={setShowBgColor}
            />
          </>
        )}

        {/* Add a photo you can drag anywhere on this section */}
        {!isTemplateMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={addingPhoto}
                onClick={(e) => {
                  e.stopPropagation();
                  photoInputRef.current?.click();
                }}
              >
                {addingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add a photo, then drag to place it.</TooltipContent>
          </Tooltip>
        )}

        {/* AI Generate */}
        {!isTemplateMode && isAiGeneratable && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAiGenerate(true);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">AI Generate</TooltipContent>
            </Tooltip>
            <AiGenerateDialog
              open={showAiGenerate}
              onOpenChange={setShowAiGenerate}
              scope="section"
              sectionId={section.id}
              sectionType={section.type}
            />
          </>
        )}

        {!isTemplateMode && <div className="bg-border h-4 w-px" />}

        {/* Move Up */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                moveSection(section.id, "up");
              }}
              disabled={isFirst}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Move Up</TooltipContent>
        </Tooltip>

        {/* Move Down */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                moveSection(section.id, "down");
              }}
              disabled={isLast}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Move Down</TooltipContent>
        </Tooltip>

        <div className="bg-border h-4 w-px" />

        {/* Visibility Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                toggleSectionVisibility(section.id);
              }}
            >
              {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isHidden ? "Show Section" : "Hide Section"}
          </TooltipContent>
        </Tooltip>

        {/* Only show duplicate and delete in full edit mode, not template mode, and not when explicitly disabled */}
        {!isTemplateMode && !disableDeleteDuplicate && (
          <>
            {/* Duplicate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSection(section.id);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Duplicate Section</TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSection(section.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Delete Section</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Hidden indicator */}
      {isHidden && (() => {
        const addAction = SECTION_ADD_ACTIONS[section.type];
        return (
          <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="bg-muted flex items-center gap-2 rounded-lg px-4 py-2">
                <EyeOff className="h-4 w-4" />
                <span className="text-sm font-medium">Hidden</span>
              </div>
              {addAction && (
                <a
                  href={addAction.href}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addAction.label}
                </a>
              )}
              <span className="text-xs text-muted-foreground">
                This section will auto-show when data is available
              </span>
            </div>
          </div>
        );
      })()}

      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first: picking the SAME file twice fires no change event
          // otherwise, so a re-upload would silently do nothing.
          e.target.value = "";
          if (file) void handleAddPhoto(file);
        }}
      />

      {/* Section content */}
      <SectionBackgroundWrapper section={section} editable>{children}</SectionBackgroundWrapper>
    </div>
  );
}

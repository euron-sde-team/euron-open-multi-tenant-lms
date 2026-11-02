"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@open-mtlms/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectionConfig, SectionType } from "@open-mtlms/shared";
import { SECTION_DEFINITIONS, SECTION_CATEGORIES } from "@open-mtlms/shared";
import { useEditorStore } from "@/lib/stores/editor-store";
import { SectionPhotoLayer } from "./section-photo-layer";
import { useEditMode } from "@/lib/edit-mode-context";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Palette,
  PaintBucket,
  Plus,
  RotateCcw,
  ChevronRight,
  Check,
  Search,
  X,
} from "lucide-react";

interface SectionWrapperProps {
  section: SectionConfig;
  children: React.ReactNode;
  index: number;
  totalSections: number;
}

// ---------------------------------------------------------------------------
// View-mode wrapper: scroll entrance micro-animation (off in edit mode)
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
// Change Style Modal – shows section types in the same category with
// their variants so the user can switch type + variant in one click.
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
  const [expandedType, setExpandedType] = useState<string | null>(section.type);

  // Find the current section's category from SECTION_DEFINITIONS
  const currentDef = useMemo(
    () => SECTION_DEFINITIONS.find((d) => d.type === section.type),
    [section.type]
  );

  // Get all section definitions in the same category
  const sameCategorySections = useMemo(() => {
    if (!currentDef) return SECTION_DEFINITIONS;
    return SECTION_DEFINITIONS.filter((d) => d.category === currentDef.category);
  }, [currentDef]);

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
      <DialogContent
        hideCloseButton
        className="max-h-[90vh] w-full max-w-md gap-0 overflow-hidden p-0 shadow-2xl"
      >
        <DialogHeader className="bg-muted/30 border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Change Style
              </DialogTitle>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Choose a layout or style for this section
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
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-2 p-4">
            {sameCategorySections.map((def) => {
              const isCurrentType = def.type === section.type;
              const isExpanded = expandedType === def.type;

              return (
                <div
                  key={def.type}
                  className={cn(
                    "overflow-hidden rounded-lg border transition-colors",
                    isExpanded ? "border-primary/50 bg-muted/20" : "border-border"
                  )}
                >
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-all",
                      "hover:bg-muted/50",
                      isCurrentType
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground"
                    )}
                    onClick={() => setExpandedType(isExpanded ? null : def.type)}
                  >
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <span className="flex-1 font-medium">{def.name}</span>
                    {isCurrentType && <Check className="h-4 w-4 shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-border/50 bg-background/50 border-t px-4 py-2">
                      <div className="space-y-1">
                        {def.variants.map((v) => {
                          const isActive = isCurrentType && v.id === section.variant;
                          return (
                            <button
                              key={v.id}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-all",
                                isActive
                                  ? "bg-primary text-primary-foreground ring-primary ring-offset-background font-medium ring-2 ring-offset-2"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              onClick={() => handleSelect(def.type as SectionType, v.id)}
                            >
                              <span className="flex-1">{v.name}</span>
                              {isActive && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
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
    const {
      backgroundColor: _backgroundColor,
      backgroundColorDark: _backgroundColorDark,
      ...rest
    } = settings;
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
              <p className="text-muted-foreground mt-0.5 text-sm">
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
                className="border-input h-10 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
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
                className="border-input h-10 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
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
}: {
  section: SectionConfig;
  children: React.ReactNode;
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
      <SectionPhotoLayer photos={photos} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Section Divider – thin line with "+" button between sections
// Uses shadcn Popover + Accordion for categories/subcategories and easy click injection
// ---------------------------------------------------------------------------
export function AddSectionDivider({ afterSectionId }: { afterSectionId?: string }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { addSection } = useEditorStore();

  const handleSelect = useCallback(
    (type: SectionType, variant: string) => {
      addSection(type, variant, afterSectionId);
      setOpen(false);
    },
    [addSection, afterSectionId]
  );

  // Group section definitions by category with variant counts
  const groupedSections = useMemo(() => {
    return SECTION_CATEGORIES.map((cat) => {
      const sections = SECTION_DEFINITIONS.filter((d) => d.category === cat.id);
      return { ...cat, sections };
    }).filter((cat) => cat.sections.length > 0);
  }, []);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedSections;
    const q = searchQuery.toLowerCase();
    return groupedSections
      .map((cat) => ({
        ...cat,
        sections: cat.sections.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.variants.some((v) => v.name.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.sections.length > 0);
  }, [groupedSections, searchQuery]);

  return (
    <div className="group/divider relative z-[55] flex items-center justify-center py-0">
      {/* The line */}
      <div className="border-primary/0 group-hover/divider:border-primary/30 absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed transition-colors" />

      {/* The + button with Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-all",
              open
                ? "border-primary bg-primary text-primary-foreground scale-100 opacity-100"
                : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary scale-75 opacity-0 group-hover/divider:scale-100 group-hover/divider:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            title="Add Section"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="center"
          side="bottom"
          sideOffset={8}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Add Section</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="border-b px-3 py-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Categories with Accordion */}
          <ScrollArea className="max-h-[320px]">
            <Accordion type="multiple" className="w-full">
              {filteredGroups.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id} className="border-b-0">
                  <AccordionTrigger className="px-4 py-2.5 text-xs font-medium hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    <div className="flex flex-1 items-center gap-2 text-left">
                      <span>{cat.name}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                        {cat.sections.reduce((a, s) => a + s.variants.length, 0)}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    <div className="space-y-2 px-4">
                      {cat.sections.map((def) => (
                        <div key={def.type} className="space-y-1">
                          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                            {def.name}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {def.variants.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => handleSelect(def.type as SectionType, v.id)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                                  "border-border bg-background hover:border-primary hover:bg-primary/10 hover:text-primary"
                                )}
                              >
                                <Plus className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                {v.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>

          {filteredGroups.length === 0 && (
            <div className="text-muted-foreground py-8 text-center text-xs">
              No sections match &quot;{searchQuery}&quot;
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionWrapper – public export
// ---------------------------------------------------------------------------
export function SectionWrapper({ section, children, index, totalSections }: SectionWrapperProps) {
  const isEditMode = useEditMode();

  // View mode: wrap with scroll entrance animation (no editor store)
  if (!isEditMode) {
    return (
      <SectionEntranceWrapper section={section} isFirstSection={index === 0}>
        {children}
      </SectionEntranceWrapper>
    );
  }

  return (
    <SectionWrapperEditor section={section} index={index} totalSections={totalSections}>
      {children}
    </SectionWrapperEditor>
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
  } = useEditorStore();

  const sectionRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedSectionId === section.id;
  const isHovered = hoveredSectionId === section.id;
  const isHidden = !section.visible;
  const isFirst = index === 0;
  const isLast = index === totalSections - 1;

  const [showChangeStyle, setShowChangeStyle] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

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
        isSelected && "ring-primary ring-2 ring-offset-2",
        isHovered && !isSelected && "ring-primary/50 ring-2",
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
          "bg-background/95 absolute right-4 top-4 z-[60] flex items-center gap-1 rounded-lg border p-1.5 shadow-lg backdrop-blur transition-all",
          "translate-y-2 opacity-0",
          (isSelected || isHovered) && "translate-y-0 opacity-100"
        )}
      >
        {/* Section Label */}
        <span className="text-muted-foreground px-2 text-xs font-medium capitalize">
          {section.type.replace(/-/g, " ")}
        </span>
        <div className="bg-border h-4 w-px" />

        {/* Change Style */}
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

        {/* Background Color */}
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

        <div className="bg-border h-4 w-px" />

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
      </div>

      {/* Hidden indicator */}
      {isHidden && (
        <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center">
          <div className="bg-muted flex items-center gap-2 rounded-lg px-4 py-2">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm font-medium">Hidden</span>
          </div>
        </div>
      )}

      {/* Section content */}
      <SectionBackgroundWrapper section={section}>{children}</SectionBackgroundWrapper>
    </div>
  );
}

"use client";

import { decodeHtmlEntities, type TextStyle } from "@open-mtlms/shared";
import { ALargeSmall, Paintbrush, Trash2, Type } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { TextSizeToolbar } from "@/components/editor/text-size-toolbar";
import { TextStyleToolbar } from "@/components/editor/text-style-toolbar";
import { useEditMode } from "@/lib/contexts/edit-mode-context";
import { useSectionStyleContext } from "@/lib/contexts/section-style-context";
import { cn } from "@/lib/utils";

const FONT_SIZE_CLASSES: Record<string, string> = {
  xs: "text-xs sm:text-sm",
  sm: "text-sm sm:text-base",
  base: "text-base sm:text-lg",
  lg: "text-lg sm:text-xl",
  xl: "text-xl sm:text-2xl",
  "2xl": "text-2xl sm:text-3xl",
  "3xl": "text-3xl sm:text-4xl",
  "4xl": "text-4xl sm:text-5xl",
  // Larger presets stay mobile-safe: the big desktop size only kicks in at
  // sm/md so long text doesn't overflow a phone.
  "5xl": "text-4xl sm:text-5xl md:text-6xl",
  "6xl": "text-5xl sm:text-6xl md:text-7xl",
};

const FONT_WEIGHT_CLASSES: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const TEXT_ALIGN_CLASSES: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function getStyleClasses(style?: TextStyle): string {
  if (!style) return "";
  const classes: string[] = [];
  if (style.fontSize && FONT_SIZE_CLASSES[style.fontSize]) {
    classes.push(FONT_SIZE_CLASSES[style.fontSize]);
  }
  if (style.fontWeight && FONT_WEIGHT_CLASSES[style.fontWeight]) {
    classes.push(FONT_WEIGHT_CLASSES[style.fontWeight]);
  }
  if (style.fontStyle === "italic") {
    classes.push("italic");
  }
  if (style.textAlign && TEXT_ALIGN_CLASSES[style.textAlign]) {
    classes.push(TEXT_ALIGN_CLASSES[style.textAlign]);
  }
  return classes.join(" ");
}

function getInlineStyle(style?: TextStyle, isDark?: boolean): React.CSSProperties {
  if (!style) return {};
  const color = isDark ? (style.colorDark ?? style.color) : style.color;
  if (!color) return {};
  return { color };
}

/** Element tag → human label for toolbar */
const TAG_LABELS: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  p: "Text",
  span: "Text",
};

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  styleKey?: string;
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  /**
   * Keep the editor in the surrounding inline flow.
   *
   * Edit mode wraps the text in a positioned container so the floating toolbar
   * has something to anchor to. That wrapper is block-level, which breaks any
   * caller that renders sibling text next to the editable value, a stat like
   * `{prefix}<EditableText/>{suffix}` rendered "200" and dropped "+" onto the
   * next line, while the published page (which has no wrapper) showed "200+".
   *
   * Opt in for those cases. Left off by default: most of the ~535 span callers
   * are the only child of their parent and rely on block layout.
   */
  inline?: boolean;
}

export function EditableText({
  value,
  onChange,
  as: Component = "span",
  className,
  placeholder = "Click to edit...",
  multiline = false,
  styleKey,
  style,
  onStyleChange,
  inline = false,
}: EditableTextProps) {
  const isEditMode = useEditMode();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const safeValue = value ?? "";
  const [isFocused, setIsFocused] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentRef = useRef<any>(null);
  const lastValueRef = useRef(safeValue);
  const initializedRef = useRef(false);

  // Use SectionStyleContext as fallback when style/onStyleChange are not provided explicitly
  const sectionStyleCtx = useSectionStyleContext();
  // When no explicit styleKey is given, auto-assign a stable one so every
  // editable text gets typography/size controls. Computed once per mount.
  const [autoStyleKey] = useState(() =>
    styleKey ? undefined : sectionStyleCtx?.getAutoKey?.(),
  );
  const resolvedStyleKey = styleKey ?? autoStyleKey;
  const effectiveStyle =
    style ?? (resolvedStyleKey ? sectionStyleCtx?.getTextStyle(resolvedStyleKey) : undefined);
  const effectiveOnStyleChange =
    onStyleChange ??
    (resolvedStyleKey && sectionStyleCtx
      ? (s: TextStyle) => sectionStyleCtx.updateTextStyle(resolvedStyleKey, s)
      : undefined);

  const styleClasses = getStyleClasses(effectiveStyle);
  const inlineStyle = getInlineStyle(effectiveStyle, isDark);

  // Set initial content on mount via ref callback (avoids dangerouslySetInnerHTML)
  const setContentRef = useCallback(
    (node: HTMLElement | null) => {
      contentRef.current = node;
      if (node && !initializedRef.current) {
        node.textContent = decodeHtmlEntities(safeValue) || placeholder;
        lastValueRef.current = safeValue;
        initializedRef.current = true;
      }
    },
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Sync external value changes (e.g. AI generate, undo), only when NOT focused
  useEffect(() => {
    if (safeValue !== lastValueRef.current && !isFocused && contentRef.current) {
      contentRef.current.textContent = decodeHtmlEntities(safeValue) || placeholder;
      lastValueRef.current = safeValue;
    }
  }, [safeValue, isFocused, placeholder]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Clear placeholder text on focus
    if (contentRef.current && !safeValue) {
      contentRef.current.textContent = "";
    }
  }, [safeValue]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const raw = (contentRef.current?.textContent ?? "").trim();
    const newValue = raw || safeValue;
    if (newValue !== safeValue) {
      onChange(newValue);
      lastValueRef.current = newValue;
    }
    // Show placeholder if empty
    if (!raw && contentRef.current) {
      contentRef.current.textContent = placeholder;
    }
  }, [safeValue, onChange, placeholder]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        contentRef.current?.blur();
      }
      if (e.key === "Escape") {
        if (contentRef.current) contentRef.current.textContent = safeValue;
        contentRef.current?.blur();
      }
    },
    [multiline, safeValue]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) {
        e.stopPropagation();
      }
    },
    [isEditMode]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      if (contentRef.current) contentRef.current.textContent = "";
    },
    [onChange]
  );

  const showStyleToolbar = isEditMode && !!effectiveOnStyleChange;
  const tagLabel = TAG_LABELS[Component] || "Text";

  const baseClassName = cn(
    isEditMode && "editable-text cursor-text",
    !isEditMode && "cursor-default",
    className,
    styleClasses,
  );

  // ── View mode (not editing), never show placeholder to end users ──
  if (!isEditMode) {
    if (!value) return null;
    return (
      <Component className={cn(baseClassName)} style={inlineStyle}>
        {decodeHtmlEntities(value)}
      </Component>
    );
  }

  // ── Edit mode: inline contentEditable with toolbar above ──
  return (
    <div
      className={cn(
        "group/edit relative",
        // `align-baseline` keeps the digits sitting on the same baseline as the
        // sibling suffix rather than the wrapper's bottom edge.
        inline && "inline-block align-baseline",
      )}
    >
      {/* ── Floating toolbar, always above text via bottom-full ── */}
      <div className={cn(
        "absolute bottom-full left-1/2 z-20 -translate-x-1/2 pb-1 transition-opacity duration-150",
        isFocused
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0 group-hover/edit:pointer-events-auto group-hover/edit:opacity-100"
      )}>
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover px-1 py-0.5 shadow-xl">
          {/* Element label */}
          <span className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-popover-foreground">
            <Type className="h-3.5 w-3.5 opacity-60" />
            <span>{tagLabel}</span>
          </span>

          {/* Size button (dedicated, separate from the paintbrush) */}
          {showStyleToolbar && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <TextSizeToolbar style={effectiveStyle} onStyleChange={effectiveOnStyleChange}>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-popover-foreground transition-colors hover:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                  title="Text size"
                >
                  <ALargeSmall className="h-4 w-4" />
                </button>
              </TextSizeToolbar>
            </>
          )}

          {/* Color / typography button */}
          {showStyleToolbar && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <TextStyleToolbar style={effectiveStyle} onStyleChange={effectiveOnStyleChange}>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-popover-foreground transition-colors hover:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                  title="Color & style"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                </button>
              </TextStyleToolbar>
            </>
          )}

          <div className="mx-0.5 h-4 w-px bg-border" />

          {/* Delete button */}
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
            onClick={handleClear}
            title="Clear text"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Inline editable text ── */}
      <Component
        ref={setContentRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          baseClassName,
          "rounded-sm outline-none ring-transparent transition-all",
          "group-hover/edit:ring-2 group-hover/edit:ring-primary/30",
          isFocused && "ring-2 ring-primary/50",
          !safeValue && !isFocused && "text-muted-foreground/50",
        )}
        style={inlineStyle}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
} from "@open-mtlms/core";
import { Expand, Loader2, Monitor, Moon, Smartphone, Sun, Tablet, X } from "lucide-react";
import { useState } from "react";

import type { PageTemplate } from "@/lib/data/page-templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewportMode = "desktop" | "tablet" | "mobile";

interface TemplatePreviewCardProps {
  template: PageTemplate;
  categoryLabel: string;
  // Kept for API compatibility with the gallery; the card now shows a static
  // thumbnail, so the device viewport only affects the enlarged preview.
  viewport?: ViewportMode;
  onClick: () => void;
}

const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

/**
 * The gallery shows up to 50 cards, so the card thumbnail must be light. Each
 * template already carries a representative `thumbnail`; for Unsplash sources we
 * request a small width so the grid stays fast. Non-Unsplash / relative URLs
 * pass through unchanged.
 */
function smallThumb(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("unsplash.com")) {
      u.searchParams.set("w", "480");
      u.searchParams.set("q", "60");
      u.searchParams.set("auto", "format");
      return u.toString();
    }
  } catch {
    // relative or malformed URL, use as-is
  }
  return url;
}

// ---------------------------------------------------------------------------
// TemplatePreviewCard, static thumbnail; live preview lives in the modal
// ---------------------------------------------------------------------------

export function TemplatePreviewCard({
  template,
  categoryLabel,
  onClick,
}: TemplatePreviewCardProps) {
  const [expandOpen, setExpandOpen] = useState(false);
  // Prefer the real captured template screenshot; fall back to the template's
  // own thumbnail for page types that don't have a capture.
  const [thumb, setThumb] = useState(`/template-thumbs/${template.id}.webp`);
  const handleThumbError = () => {
    const fallback = smallThumb(template.thumbnail);
    setThumb((cur) => (cur !== fallback ? fallback : ""));
  };

  return (
    <>
      <Card
        className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="bg-muted relative mb-3 h-[180px] overflow-hidden rounded-md">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={`${template.name} preview`}
                loading="lazy"
                onError={handleThumbError}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="text-muted-foreground/40 flex h-full items-center justify-center text-xs">
                No preview
              </div>
            )}

            {/* Category badge */}
            <div className="absolute left-2 top-2 z-20">
              <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                {categoryLabel}
              </Badge>
            </div>

            {/* Expand button, visible on hover */}
            <button
              className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                setExpandOpen(true);
              }}
              title="Preview full template"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          </div>

          <CardTitle className="text-sm">{template.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="line-clamp-2 text-xs">
            {template.description}
          </CardDescription>
          <p className="text-muted-foreground/60 mt-2 text-[10px]">
            {template.sections.length} section
            {template.sections.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {expandOpen && (
        <TemplateExpandModal
          template={template}
          open={expandOpen}
          onOpenChange={setExpandOpen}
          onSelect={onClick}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TemplateExpandModal, full-screen live preview with viewport + theme toggle
// ---------------------------------------------------------------------------

export interface TemplateExpandModalProps {
  template: PageTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
}

export function TemplateExpandModal({
  template,
  open,
  onOpenChange,
  onSelect,
}: TemplateExpandModalProps) {
  const [previewViewport, setPreviewViewport] = useState<ViewportMode>("desktop");
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [loaded, setLoaded] = useState(false);

  const iframeWidth = VIEWPORT_WIDTHS[previewViewport];
  const isDesktop = previewViewport === "desktop";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="flex flex-col gap-0 overflow-hidden p-0"
        style={{
          width: "calc(100vw - 40px)",
          maxWidth: isDesktop ? "1500px" : "900px",
          height: "90vh",
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">{template.name}</h3>
            <span className="text-muted-foreground text-xs">
              {template.sections.length} section{template.sections.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport toggle */}
            <div className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
              {(
                [
                  { mode: "desktop" as ViewportMode, icon: Monitor, label: "Desktop" },
                  { mode: "tablet" as ViewportMode, icon: Tablet, label: "Tablet" },
                  { mode: "mobile" as ViewportMode, icon: Smartphone, label: "Mobile" },
                ]
              ).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    previewViewport === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setPreviewViewport(mode)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Light / dark toggle, reuses the storefront dark mechanism */}
            <button
              className="bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
              onClick={() => {
                setPreviewMode((m) => (m === "light" ? "dark" : "light"));
                setLoaded(false);
              }}
              title={previewMode === "light" ? "Switch to dark" : "Switch to light"}
            >
              {previewMode === "light" ? (
                <>
                  <Moon className="h-3.5 w-3.5" /> Dark
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" /> Light
                </>
              )}
            </button>

            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onSelect();
              }}
            >
              Use Template
            </Button>

            <button
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview area, iframe scrolls internally */}
        <div className="bg-muted/50 relative flex flex-1 justify-center overflow-hidden p-4">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          )}

          <div
            className="bg-background overflow-hidden rounded-lg shadow-lg"
            style={{
              width: isDesktop ? "100%" : `${iframeWidth}px`,
              height: "100%",
            }}
          >
            {/* Keyed on theme so switching light/dark reloads the preview with
                the chosen mode; viewport changes just resize the same iframe. */}
            <iframe
              key={previewMode}
              src={`/preview/template/${template.id}?mode=${previewMode}`}
              title={`Full preview: ${template.name}`}
              onLoad={() => setLoaded(true)}
              className="border-0"
              style={{
                width: "100%",
                height: "100%",
                opacity: loaded ? 1 : 0,
                transition: "opacity 300ms ease",
              }}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

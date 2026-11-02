"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { Check, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewportMode = "desktop" | "tablet" | "mobile";

interface SectionPreviewCardProps {
  type: string;
  variant: string;
  sectionName: string;
  sectionDescription: string;
  categoryLabel: string;
  viewport?: ViewportMode;
  onClick: () => void;
  /** For Change Style modal: show checkmark when this is the active style */
  isActive?: boolean;
  /** For Add Section: show plus icon */
  showAddIcon?: boolean;
}

// Iframe dimensions per viewport
const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

const IFRAME_HEIGHT = 5000;

// ---------------------------------------------------------------------------
// Helpers, safe iframe scroll access
// ---------------------------------------------------------------------------

function getIframeDoc(iframe: HTMLIFrameElement | null) {
  try {
    return iframe?.contentDocument?.documentElement ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SectionPreviewCard
// ---------------------------------------------------------------------------

export function SectionPreviewCard({
  type,
  variant,
  sectionName,
  sectionDescription,
  categoryLabel,
  viewport = "desktop",
  onClick,
  isActive = false,
  showAddIcon = true,
}: SectionPreviewCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const animFrameRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scale, setScale] = useState(0.22);

  const iframeWidth = VIEWPORT_WIDTHS[viewport];
  const previewUrl = `/preview/section/${encodeURIComponent(type)}/${encodeURIComponent(variant)}`;

  // Compute scale: fit iframe width into container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const computeScale = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / iframeWidth);
    };

    computeScale();
    const observer = new ResizeObserver(computeScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [iframeWidth]);

  // Lazy load: only mount iframe when card scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hover-to-scroll
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const doc = getIframeDoc(iframeRef.current);
    if (!doc) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    if (maxScroll <= 0) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const targetScroll = ratio * maxScroll;
    const startScroll = doc.scrollTop;
    const distance = targetScroll - startScroll;
    const duration = Math.min(600, Math.abs(distance) * 1.5);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / Math.max(duration, 1));
      const ease = 1 - Math.pow(1 - progress, 3);
      doc.scrollTop = startScroll + distance * ease;
      if (progress < 1) animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const doc = getIframeDoc(iframeRef.current);
    if (!doc) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startScroll = doc.scrollTop;
    if (startScroll === 0) return;

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / 400);
      const ease = 1 - Math.pow(1 - progress, 3);
      doc.scrollTop = startScroll * (1 - ease);
      if (progress < 1) animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const scaledHeight = IFRAME_HEIGHT * scale;

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
        isActive && "ring-2 ring-primary border-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div
          ref={containerRef}
          className="bg-muted relative mb-3 overflow-hidden rounded-md"
          style={{ height: Math.min(scaledHeight, 180) }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Loading spinner */}
          {(!isVisible || !isLoaded) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="text-muted-foreground/40 h-6 w-6 animate-spin" />
            </div>
          )}

          {/* Scaled iframe preview */}
          {isVisible && (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title={`Preview: ${sectionName}`}
              onLoad={() => setIsLoaded(true)}
              className="absolute left-0 top-0 border-0"
              style={{
                width: `${iframeWidth}px`,
                height: `${IFRAME_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
              sandbox="allow-same-origin allow-scripts"
              loading="lazy"
              tabIndex={-1}
            />
          )}

          {/* Category badge */}
          <div className="absolute left-2 top-2 z-20">
            <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
              {categoryLabel}
            </Badge>
          </div>

          {/* Add indicator on hover, or Check when active */}
          {isActive ? (
            <div className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" />
            </div>
          ) : showAddIcon ? (
            <div className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80">
              <Plus className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>

        <CardTitle className="text-sm">{sectionName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="line-clamp-2 text-xs">
          {sectionDescription}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

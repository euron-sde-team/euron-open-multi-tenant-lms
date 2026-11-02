"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import { Check, ChevronLeft, ChevronRight, Expand, LayoutTemplate, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PageTemplate } from "@/lib/data/page-templates";

import { TemplateExpandModal, type ViewportMode } from "./template-preview-card";

interface TemplateCarouselProps {
  templates: PageTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: PageTemplate) => void;
}

const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

const IFRAME_HEIGHT = 5000;

export function TemplateCarousel({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: TemplateCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleCount = 3;
  const maxIndex = Math.max(0, templates.length - visibleCount);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  const visibleTemplates = templates.slice(currentIndex, currentIndex + visibleCount);

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <LayoutTemplate className="text-muted-foreground/50 mb-4 h-12 w-12" />
        <p className="text-muted-foreground">No templates available for this page type.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Carousel Container */}
      <div className="relative">
        {/* Navigation Buttons */}
        {templates.length > visibleCount && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="bg-background absolute -left-4 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-background absolute -right-4 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
              onClick={goToNext}
              disabled={currentIndex >= maxIndex}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Templates Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((template) => (
            <CarouselPreviewCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={() => onSelectTemplate(template)}
            />
          ))}
        </div>
      </div>

      {/* Pagination Dots */}
      {templates.length > visibleCount && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Template Count */}
      <p className="text-muted-foreground text-center text-xs">
        {templates.length} template{templates.length !== 1 ? "s" : ""} available
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CarouselPreviewCard, live iframe preview with expand button
// ---------------------------------------------------------------------------

interface CarouselPreviewCardProps {
  template: PageTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

function CarouselPreviewCard({ template, isSelected, onSelect }: CarouselPreviewCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const animFrameRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scale, setScale] = useState(0.22);
  const [expandOpen, setExpandOpen] = useState(false);

  const iframeWidth = VIEWPORT_WIDTHS.desktop;

  // Compute scale
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / iframeWidth);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [iframeWidth]);

  // Lazy load
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

  // Safe iframe doc access
  const getDoc = () => {
    try {
      return iframeRef.current?.contentDocument?.documentElement ?? null;
    } catch {
      return null;
    }
  };

  // Hover-to-scroll
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const doc = getDoc();
    if (!doc) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    if (maxScroll <= 0) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const target = ratio * maxScroll;
    const start = doc.scrollTop;
    const dist = target - start;
    const dur = Math.min(600, Math.abs(dist) * 1.5);
    const t0 = performance.now();

    const animate = (now: number) => {
      const p = Math.min(1, (now - t0) / Math.max(dur, 1));
      doc.scrollTop = start + dist * (1 - Math.pow(1 - p, 3));
      if (p < 1) animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const doc = getDoc();
    if (!doc) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const start = doc.scrollTop;
    if (start === 0) return;

    const t0 = performance.now();
    const animate = (now: number) => {
      const p = Math.min(1, (now - t0) / 400);
      doc.scrollTop = start * (1 - (1 - Math.pow(1 - p, 3)));
      if (p < 1) animFrameRef.current = requestAnimationFrame(animate);
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
    <>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md ${
          isSelected ? "ring-primary border-primary ring-2" : "hover:border-primary/50"
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-2">
          <div
            ref={containerRef}
            className="bg-muted relative mb-3 overflow-hidden rounded-md"
            style={{ height: Math.min(scaledHeight, 180) }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {(!isVisible || !isLoaded) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <Loader2 className="text-muted-foreground/40 h-6 w-6 animate-spin" />
              </div>
            )}

            {isVisible && (
              <iframe
                ref={iframeRef}
                src={`/preview/template/${template.id}`}
                title={`Preview: ${template.name}`}
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

            {/* Selected indicator */}
            {isSelected && (
              <div className="bg-primary absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full">
                <Check className="text-primary-foreground h-4 w-4" />
              </div>
            )}

            {/* Expand button */}
            {!isSelected && (
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
            )}
          </div>

          <CardTitle className="text-sm">{template.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="line-clamp-2 text-xs">
            {template.description}
          </CardDescription>
        </CardContent>
      </Card>

      {expandOpen && (
        <TemplateExpandModal
          template={template}
          open={expandOpen}
          onOpenChange={setExpandOpen}
          onSelect={onSelect}
        />
      )}
    </>
  );
}

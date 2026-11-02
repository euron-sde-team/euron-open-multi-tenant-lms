"use client";

import { Badge, Card } from "@open-mtlms/core";
import { Check, Expand, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TemplateExpandModal } from "@/components/pages/template-preview-card";
import { getTemplatesByPageCategory, type PageTemplate } from "@/lib/data/page-templates";
import { cn } from "@/lib/utils";

const IFRAME_WIDTH = 1440;
const IFRAME_HEIGHT = 5000;

interface StepTemplateProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export function StepTemplate({ selectedTemplateId, onSelectTemplate }: StepTemplateProps) {
  const templates = useMemo(() => getTemplatesByPageCategory("home"), []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Choose Your Homepage Template</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a style for your homepage. Other pages (About, Contact, FAQ, Privacy, Terms) will use
          their default templates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onSelect={() => onSelectTemplate(template.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Safe iframe document access for scroll animation
function getIframeDoc(iframe: HTMLIFrameElement | null) {
  try {
    return iframe?.contentDocument?.documentElement ?? null;
  } catch {
    return null;
  }
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: PageTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const animFrameRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scale, setScale] = useState(0.25);
  const [expandOpen, setExpandOpen] = useState(false);

  // Compute scale: fit iframe width into container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const computeScale = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / IFRAME_WIDTH);
    };

    computeScale();
    const observer = new ResizeObserver(computeScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hover-to-scroll: move mouse vertically over card to scroll the iframe preview
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

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const scaledHeight = IFRAME_HEIGHT * scale;

  return (
    <>
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all hover:shadow-md",
        isSelected && "ring-primary ring-2",
      )}
      onClick={onSelect}
    >
      {/* Live iframe preview */}
      <div
        ref={containerRef}
        className="bg-muted relative overflow-hidden"
        style={{ height: Math.min(scaledHeight, 220) }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Loading spinner */}
        {(!isVisible || !isLoaded) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="text-muted-foreground/40 h-6 w-6 animate-spin" />
          </div>
        )}

        {/* Scaled iframe */}
        {isVisible && (
          <iframe
            ref={iframeRef}
            src={`/preview/template/${template.id}`}
            title={`Preview: ${template.name}`}
            onLoad={() => setIsLoaded(true)}
            className="absolute left-0 top-0 border-0"
            style={{
              width: `${IFRAME_WIDTH}px`,
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

        {/* Selection checkmark */}
        {isSelected && (
          <div className="bg-primary absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full">
            <Check className="text-primary-foreground h-4 w-4" />
          </div>
        )}

        {/* Expand button, visible on hover */}
        <button
          className="absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80"
          onClick={(e) => {
            e.stopPropagation();
            setExpandOpen(true);
          }}
          title="Preview full template"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {template.category}
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-xs">{template.description}</p>
      </div>
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

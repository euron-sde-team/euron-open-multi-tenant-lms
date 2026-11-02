"use client";

/**
 * View-only editable component stubs for the web (student-facing) portal.
 * Web is read-only, all onChange/onStyleChange props are accepted for
 * interface compatibility but ignored.
 */

import Image from "next/image";
import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { decodeHtmlEntities, parseVideoUrl, type TextStyle, type VideoInfo } from "@open-mtlms/shared";
import { useTheme } from "next-themes";

import { useSectionStyleContext } from "@/lib/contexts/section-style-context";
import { cn } from "@/lib/utils";

// ─── EditableText ────────────────────────────────────────────────────────────

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
  if (style.fontSize && FONT_SIZE_CLASSES[style.fontSize]) classes.push(FONT_SIZE_CLASSES[style.fontSize]);
  if (style.fontWeight && FONT_WEIGHT_CLASSES[style.fontWeight]) classes.push(FONT_WEIGHT_CLASSES[style.fontWeight]);
  if (style.fontStyle === "italic") classes.push("italic");
  if (style.textAlign && TEXT_ALIGN_CLASSES[style.textAlign]) classes.push(TEXT_ALIGN_CLASSES[style.textAlign]);
  return classes.join(" ");
}

function getInlineStyle(style?: TextStyle, isDark?: boolean): React.CSSProperties {
  if (!style) return {};
  const color = isDark ? (style.colorDark ?? style.color) : style.color;
  return color ? { color } : {};
}

interface EditableTextProps {
  value: string;
  onChange?: (value: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  styleKey?: string;
  style?: TextStyle;
  onStyleChange?: (style: TextStyle) => void;
  /**
   * Accepted for parity with the admin editor's prop contract, where it stops
   * the toolbar wrapper from breaking inline flow. Nothing to do here, this
   * renders the tag directly, so it is already inline.
   */
  inline?: boolean;
}

export function EditableText({
  value,
  as: Component = "span",
  className,
  styleKey,
  style,
}: EditableTextProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const sectionStyleCtx = useSectionStyleContext();
  // Mirror the admin editor: unkeyed texts get a stable mount-order auto key so
  // the size/typography saved in the editor applies to the same element here.
  const [autoStyleKey] = useState(() =>
    styleKey ? undefined : sectionStyleCtx?.getAutoKey?.(),
  );
  const resolvedStyleKey = styleKey ?? autoStyleKey;
  const effectiveStyle =
    style ?? (resolvedStyleKey ? sectionStyleCtx?.getTextStyle(resolvedStyleKey) : undefined);

  const styleClasses = getStyleClasses(effectiveStyle);
  const inlineStyle = getInlineStyle(effectiveStyle, isDark);

  return (
    <Component className={cn(className, styleClasses)} style={inlineStyle}>
      {decodeHtmlEntities(value)}
    </Component>
  );
}

// ─── EditableImage ────────────────────────────────────────────────────────────

interface EditableImageProps {
  src: string;
  alt: string;
  onChange?: (src: string, alt: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholder?: string;
}

export function EditableImage({ src, alt, className, aspectRatio = "auto" }: EditableImageProps) {
  if (!src) return null;

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "",
  }[aspectRatio];

  return (
    <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
      <Image src={src} alt={alt} fill className="object-cover" unoptimized />
    </div>
  );
}

// ─── EditableMedia ────────────────────────────────────────────────────────────

interface EditableMediaProps {
  image?: string;
  imageAlt?: string;
  videoUrl?: string;
  onImageChange?: (src: string, alt: string) => void;
  onVideoChange?: (url: string) => void;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  placeholder?: string;
}

export function EditableMedia({
  image,
  imageAlt = "",
  videoUrl,
  className,
  aspectRatio = "video",
}: EditableMediaProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);

  useEffect(() => {
    if (videoUrl) {
      setVideoInfo(parseVideoUrl(videoUrl));
    } else {
      setVideoInfo(null);
      setIsPlaying(false);
    }
  }, [videoUrl]);

  const aspectRatioClass = { video: "aspect-video", square: "aspect-square", auto: "" }[aspectRatio];
  const thumbnailSrc =
    image ||
    (videoInfo?.source === "youtube" && videoInfo.videoId
      ? `https://img.youtube.com/vi/${videoInfo.videoId}/maxresdefault.jpg`
      : videoInfo?.source === "vimeo" && videoInfo.videoId
        ? `https://vumbnail.com/${videoInfo.videoId}.jpg`
        : null);

  if (!image && !videoUrl) return null;

  const renderPlayer = () => {
    if (!videoInfo?.isValid) return null;
    if (videoInfo.source === "youtube" || videoInfo.source === "vimeo") {
      const sep = videoInfo.embedUrl?.includes("?") ? "&" : "?";
      return (
        <iframe
          src={`${videoInfo.embedUrl}${sep}autoplay=1&rel=0`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <video src={videoInfo.url} className="absolute inset-0 h-full w-full object-cover" autoPlay controls playsInline />
    );
  };

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspectRatioClass, className)}>
      {isPlaying && videoInfo?.isValid ? (
        renderPlayer()
      ) : (
        <>
          {thumbnailSrc && (
            <Image src={thumbnailSrc} alt={imageAlt || "Media"} fill className="object-cover" unoptimized />
          )}
          {videoUrl && videoInfo?.isValid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(true);
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-110">
                <Play className="ml-1 h-8 w-8" fill="currentColor" />
              </div>
            </button>
          )}
        </>
      )}
    </div>
  );
}

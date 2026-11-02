"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  HeroCodeTechContent,
  HeroCodeTechEditorChrome,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { EditableStringList } from "../EditableStringList";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroCodeTechSectionProps {
  section: SectionConfig;
}

export function HeroCodeTechSection({ section }: HeroCodeTechSectionProps) {
  const content = section.content as HeroCodeTechContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableMedia,
    EditableImage,
    LinkComponent,
  } = useSectionEditor();

  const handleContentUpdate = (
    key: keyof HeroCodeTechContent,
    value: unknown,
  ) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleChromeUpdate = (
    field: keyof HeroCodeTechEditorChrome,
    value: string,
  ) => {
    updateSectionContent(section.id, {
      editorChrome: { ...(content.editorChrome ?? {}), [field]: value },
    });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) {
      delete next[styleKey];
    } else {
      next[styleKey] = style;
    }
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "relative grid min-h-[100svh] items-center overflow-hidden",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* ── Animated background ── */}
      {!hasCustomBg && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {/* Left nebula glow, more vivid in light mode, softer in dark */}
          <div
            className="absolute -left-[10%] top-[5%] h-[70%] w-[45%] rounded-full blur-[120px]"
            style={{ background: "hsl(var(--primary) / 0.15)", animation: "heroBgOrb1 16s ease-in-out infinite" }}
          />
          {/* Right deep glow */}
          <div
            className="absolute right-[5%] top-[20%] h-[50%] w-[35%] rounded-full blur-[100px]"
            style={{ background: "hsl(var(--primary) / 0.08)", animation: "heroBgOrb2 20s ease-in-out infinite" }}
          />

          {/* ── Starfield + orbit rings (single SVG) ── */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1400 700"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="heroRingFade" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ── Stars, use primary color so they're visible in both light & dark ── */}
            {/* dim tiny */}
            <circle cx="42"  cy="38"  r="0.8" fill="hsl(var(--primary))" opacity="0.2" />
            <circle cx="130" cy="95"  r="0.6" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="210" cy="42"  r="1"   fill="hsl(var(--primary))" opacity="0.22" />
            <circle cx="285" cy="120" r="0.7" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="60"  cy="190" r="0.9" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="170" cy="250" r="0.6" fill="hsl(var(--primary))" opacity="0.12" />
            <circle cx="340" cy="200" r="1"   fill="hsl(var(--primary))" opacity="0.22" />
            <circle cx="90"  cy="320" r="0.7" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="240" cy="380" r="0.8" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="50"  cy="440" r="1"   fill="hsl(var(--primary))" opacity="0.2" />
            <circle cx="310" cy="460" r="0.6" fill="hsl(var(--primary))" opacity="0.13" />
            <circle cx="140" cy="530" r="0.9" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="270" cy="580" r="0.7" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="80"  cy="620" r="1"   fill="hsl(var(--primary))" opacity="0.2" />
            <circle cx="200" cy="660" r="0.6" fill="hsl(var(--primary))" opacity="0.16" />
            {/* right side stars */}
            <circle cx="1050" cy="55"  r="0.8" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="1180" cy="30"  r="1"   fill="hsl(var(--primary))" opacity="0.22" />
            <circle cx="1300" cy="110" r="0.7" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="1360" cy="200" r="0.9" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="1100" cy="280" r="0.6" fill="hsl(var(--primary))" opacity="0.13" />
            <circle cx="1250" cy="350" r="1"   fill="hsl(var(--primary))" opacity="0.2" />
            <circle cx="1380" cy="420" r="0.8" fill="hsl(var(--primary))" opacity="0.16" />
            <circle cx="1080" cy="500" r="0.7" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="1200" cy="570" r="1"   fill="hsl(var(--primary))" opacity="0.22" />
            <circle cx="1320" cy="620" r="0.6" fill="hsl(var(--primary))" opacity="0.13" />
            <circle cx="1150" cy="660" r="0.9" fill="hsl(var(--primary))" opacity="0.18" />
            {/* mid scatter */}
            <circle cx="500" cy="60"  r="0.8" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="620" cy="25"  r="1"   fill="hsl(var(--primary))" opacity="0.22" />
            <circle cx="750" cy="80"  r="0.7" fill="hsl(var(--primary))" opacity="0.15" />
            <circle cx="900" cy="45"  r="0.9" fill="hsl(var(--primary))" opacity="0.18" />
            <circle cx="440" cy="640" r="0.8" fill="hsl(var(--primary))" opacity="0.16" />
            <circle cx="560" cy="680" r="0.6" fill="hsl(var(--primary))" opacity="0.13" />
            <circle cx="680" cy="650" r="1"   fill="hsl(var(--primary))" opacity="0.2" />
            {/* brighter accent stars with twinkle */}
            <circle cx="155" cy="155"  r="1.5" fill="hsl(var(--primary))" opacity="0.6" style={{ animation: "heroStarTwinkle 3s ease-in-out infinite" }} />
            <circle cx="380" cy="90"   r="1.3" fill="hsl(var(--primary))" opacity="0.5" style={{ animation: "heroStarTwinkle 4s ease-in-out infinite 1s" }} />
            <circle cx="1270" cy="145" r="1.5" fill="hsl(var(--primary))" opacity="0.55" style={{ animation: "heroStarTwinkle 5s ease-in-out infinite 0.5s" }} />
            <circle cx="1060" cy="390" r="1.3" fill="hsl(var(--primary))" opacity="0.5" style={{ animation: "heroStarTwinkle 3.5s ease-in-out infinite 2s" }} />
            <circle cx="670"  cy="590" r="1.4" fill="hsl(var(--primary))" opacity="0.5" style={{ animation: "heroStarTwinkle 4.5s ease-in-out infinite 1.5s" }} />

            {/* ── Orbit rings  (center: 970, 350) ── */}
            <circle cx="970" cy="350" r="165" stroke="hsl(var(--primary))" strokeWidth="1"   fill="none" opacity="0.22" />
            <circle cx="970" cy="350" r="265" stroke="hsl(var(--primary))" strokeWidth="0.8" fill="none" opacity="0.15" />
            <circle cx="970" cy="350" r="375" stroke="hsl(var(--primary))" strokeWidth="0.7" fill="none" opacity="0.1" />
            <circle cx="970" cy="350" r="490" stroke="hsl(var(--primary))" strokeWidth="0.5" fill="none" opacity="0.06" />

            {/* Inner ring glow disc */}
            <circle cx="970" cy="350" r="120" fill="url(#heroRingFade)" />

            {/* ── Orbit dots, primary color for light/dark ── */}
            {/* Ring 1 dot */}
            <circle cx="970" cy="185" r="7" fill="hsl(var(--primary))" opacity="0.55">
              <animateTransform attributeName="transform" type="rotate" from="0 970 350" to="360 970 350" dur="22s" repeatCount="indefinite" />
            </circle>
            {/* Ring 2 dot A */}
            <circle cx="970" cy="85" r="5.5" fill="hsl(var(--primary))" opacity="0.45">
              <animateTransform attributeName="transform" type="rotate" from="120 970 350" to="480 970 350" dur="34s" repeatCount="indefinite" />
            </circle>
            {/* Ring 2 dot B, opposite */}
            <circle cx="970" cy="615" r="4" fill="hsl(var(--primary))" opacity="0.4">
              <animateTransform attributeName="transform" type="rotate" from="300 970 350" to="660 970 350" dur="34s" repeatCount="indefinite" />
            </circle>
            {/* Ring 3 dot */}
            <circle cx="970" cy="-25" r="6" fill="hsl(var(--primary))" opacity="0.35">
              <animateTransform attributeName="transform" type="rotate" from="60 970 350" to="420 970 350" dur="48s" repeatCount="indefinite" />
            </circle>
            {/* Ring 4 dot */}
            <circle cx="970" cy="-140" r="5" fill="hsl(var(--primary))" opacity="0.3">
              <animateTransform attributeName="transform" type="rotate" from="200 970 350" to="560 970 350" dur="62s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Top glow line */}
          <div
            className="absolute left-[5%] top-0 h-px w-[55%]"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.45), hsl(var(--accent) / 0.25), transparent)",
              animation: "heroBgGlow 4s ease-in-out infinite alternate",
            }}
          />
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-40"
            style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 sm:px-8 lg:px-14">
        <div className="grid items-center gap-5 pb-6 pt-5 sm:gap-8 sm:pb-10 sm:pt-7 lg:grid-cols-2 lg:gap-8 lg:pb-16 lg:pt-10">
          {/* ── Left column ── */}
          <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:gap-5 lg:items-start lg:text-left lg:mx-0 mx-auto w-full">
            {/* Badge */}
            {(isEditMode || content.badge) && (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-md sm:gap-2.5 sm:px-4 sm:py-2 sm:text-[13px]">
                <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]" />
                <EditableText
                  value={content.badge || ""}
                  onChange={(value) => handleContentUpdate("badge", value)}
                  styleKey="badge"
                  style={content.textStyles?.badge}
                  onStyleChange={(s) => handleTextStyleChange("badge", s)}
                 
                />
              </div>
            )}

            {/* Headline */}
            <div className="mx-auto w-full max-w-[560px] lg:mx-0">
              <EditableText
                value={content.headline}
                onChange={(value) => handleContentUpdate("headline", value)}
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
                as="h1"
                className="break-words text-[clamp(1.75rem,6vw,3.6rem)] font-black leading-[1.1] tracking-tight"
              />
              {/* Second headline row: prefix + accent */}
              {(isEditMode || content.headlinePrefix || content.headlineAccent) && (
                <div className="mt-0.5">
                  {(isEditMode || content.headlinePrefix) && (
                    <EditableText
                      value={content.headlinePrefix || ""}
                      onChange={(value) =>
                        handleContentUpdate("headlinePrefix", value)
                      }
                      styleKey="headlinePrefix"
                      style={content.textStyles?.headlinePrefix}
                      onStyleChange={(s) => handleTextStyleChange("headlinePrefix", s)}
                      as="p"
                      className="text-[clamp(1.75rem,6vw,3.6rem)] font-black leading-[1.1] tracking-tight"
                     
                    />
                  )}
                  {(isEditMode || content.headlineAccent) && (
                    <EditableText
                      value={content.headlineAccent}
                      onChange={(value) =>
                        handleContentUpdate("headlineAccent", value)
                      }
                      styleKey="headlineAccent"
                      style={content.textStyles?.headlineAccent}
                      onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                      as="p"
                      className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-[clamp(1.75rem,6vw,3.6rem)] font-black italic leading-[1.1] tracking-tight text-transparent"
                     
                    />
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {(isEditMode || content.description) && (
              <EditableText
                value={content.description || ""}
                onChange={(value) =>
                  handleContentUpdate("description", value)
                }
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                as="p"
                className="mx-auto max-w-[440px] text-[0.875rem] font-light leading-[1.7] text-muted-foreground sm:mx-0 sm:text-[clamp(0.875rem,1.3vw,1rem)] sm:leading-[1.75] lg:mx-0"
               
              />
            )}

            {/* CTAs */}
            <div className="flex w-full max-w-xs flex-col items-center gap-2.5 sm:max-w-none sm:w-auto sm:flex-row lg:items-start">
              {content.primaryCta && !content.primaryCta.hidden && (
                <EditableClickable
                  href={content.primaryCta.href}
                  onHrefChange={(href) =>
                    handleContentUpdate("primaryCta", {
                      ...content.primaryCta,
                      href,
                    })
                  }
                  hidden={content.primaryCta.hidden}
                  onHiddenChange={(hidden) =>
                    handleContentUpdate("primaryCta", {
                      ...content.primaryCta,
                      hidden,
                    })
                  }
                  isEditing={isEditMode}
                  slotLabel="Primary Button"
                >
                  <Button
                    size="lg"
                    asChild={!isEditMode}
                    className="w-full rounded-xl px-7 py-3 text-[14px] font-semibold tracking-wide shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] sm:w-auto sm:rounded-2xl sm:px-8 sm:py-4 sm:text-[15px]"
                  >
                    {isEditMode ? (
                      <span className="inline-flex items-center gap-3">
                        <EditableText
                          value={content.primaryCta.text}
                          onChange={(value) =>
                            handleContentUpdate("primaryCta", {
                              ...content.primaryCta,
                              text: value,
                            })
                          }
                          styleKey="primaryCta"
                          style={content.textStyles?.primaryCta}
                          onStyleChange={(s) => handleTextStyleChange("primaryCta", s)}
                        />
                        <ArrowIcon />
                      </span>
                    ) : (
                      <LinkComponent
                        href={content.primaryCta.href}
                        className="inline-flex items-center gap-3"
                      >
                        {content.primaryCta.text}
                        <ArrowIcon />
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}

              {content.secondaryCta && !content.secondaryCta.hidden && (
                <EditableClickable
                  href={content.secondaryCta.href}
                  onHrefChange={(href) =>
                    handleContentUpdate("secondaryCta", {
                      ...content.secondaryCta,
                      href,
                    })
                  }
                  hidden={content.secondaryCta.hidden}
                  onHiddenChange={(hidden) =>
                    handleContentUpdate("secondaryCta", {
                      ...content.secondaryCta,
                      hidden,
                    })
                  }
                  isEditing={isEditMode}
                  slotLabel="Secondary Button"
                >
                  <Button
                    size="lg"
                    variant="ghost"
                    asChild={!isEditMode}
                    className="rounded-xl px-5 py-3 text-[14px] font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground sm:rounded-2xl sm:border sm:border-border/30 sm:bg-muted/10 sm:px-6 sm:py-4 sm:text-[15px] sm:backdrop-blur-sm sm:hover:border-primary/20 sm:hover:scale-[1.02]"
                  >
                    {isEditMode ? (
                      <span className="inline-flex items-center gap-2.5">
                        <PlayIcon />
                        <EditableText
                          value={content.secondaryCta.text}
                          onChange={(value) =>
                            handleContentUpdate("secondaryCta", {
                              ...content.secondaryCta,
                              text: value,
                            })
                          }
                          styleKey="secondaryCta"
                          style={content.textStyles?.secondaryCta}
                          onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
                        />
                      </span>
                    ) : (
                      <LinkComponent
                        href={content.secondaryCta.href}
                        className="inline-flex items-center gap-2.5"
                      >
                        <PlayIcon />
                        {content.secondaryCta.text}
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}
            </div>

            {/* Tech logos */}
            {content.techLogos && content.techLogos.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1 sm:gap-5 sm:pt-2 lg:justify-start">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
                  <EditableLabel
                    value={content.techLogosLabel}
                    fallback="Learn"
                    onChange={(v) => handleContentUpdate("techLogosLabel", v)}
                    styleKey="techLogosLabel"
                    style={content.textStyles?.techLogosLabel}
                    onStyleChange={(s) => handleTextStyleChange("techLogosLabel", s)}
                  />
                </span>
                {content.techLogos.map((logo, index) => (
                  <div
                    key={logo.id}
                    className="group flex cursor-default items-center gap-1.5"
                  >
                    {/* Logo: uploaded image wins over the built-in glyph. In edit
                        mode the glyph doubles as the upload target, so the icon is
                        changeable without retyping the label beside it. */}
                    {isEditMode ? (
                      <EditableImage
                        src={logo.logoImage || ""}
                        alt={logo.name}
                        onChange={(src) => {
                          const newLogos = [...(content.techLogos || [])];
                          newLogos[index] = { ...newLogos[index], logoImage: src };
                          handleContentUpdate("techLogos", newLogos);
                        }}
                        className="h-5 w-5 shrink-0 object-contain"
                        aspectRatio="square"
                        compact
                        placeholder={logo.name}
                      />
                    ) : logo.logoImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo.logoImage}
                        alt={logo.name}
                        className="h-5 w-5 shrink-0 object-contain opacity-60 transition-opacity group-hover:opacity-100"
                      />
                    ) : (
                      <TechLogoIcon name={logo.icon || logo.name} />
                    )}
                    <span className="text-[12px] font-medium text-muted-foreground/70 transition-colors group-hover:text-muted-foreground">
                      {isEditMode ? (
                        <EditableText
                          value={logo.name}
                          onChange={(value) => {
                            const newLogos = [...(content.techLogos || [])];
                            newLogos[index] = { ...newLogos[index], name: value };
                            handleContentUpdate("techLogos", newLogos);
                          }}
                          styleKey={`techLogo_${index}`}
                          style={content.textStyles?.[`techLogo_${index}`]}
                          onStyleChange={(s) => handleTextStyleChange(`techLogo_${index}`, s)}
                        />
                      ) : (
                        logo.name
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* ── Right column: Visual ── */}
          <div className="relative flex items-center justify-center lg:justify-end">
            {/* Main image/media card */}
            <div className="relative z-10 w-full max-w-[380px] sm:max-w-[480px]">
              <div className="overflow-hidden rounded-xl border border-border/30 shadow-xl shadow-black/15 sm:rounded-2xl sm:shadow-2xl sm:shadow-black/20 dark:shadow-black/60">
                {/* Editor header bar */}
                <div className="flex items-center justify-between border-b border-border/20 bg-muted/10 px-3 py-2 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-[7px]">
                      <div className="h-[11px] w-[11px] rounded-full bg-red-400/80" />
                      <div className="h-[11px] w-[11px] rounded-full bg-amber-400/80" />
                      <div className="h-[11px] w-[11px] rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="ml-1 flex gap-1">
                      <span className="rounded-md border border-primary/10 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-medium text-primary/80">
                        <EditableLabel
                          value={content.editorChrome?.activeTab}
                          fallback="dashboard.tsx"
                          onChange={(v) => handleChromeUpdate("activeTab", v)}
                        />
                      </span>
                      <span className="rounded-md px-2.5 py-1 font-mono text-[11px] text-muted-foreground/60">
                        <EditableLabel
                          value={content.editorChrome?.inactiveTab}
                          fallback="api.ts"
                          onChange={(v) => handleChromeUpdate("inactiveTab", v)}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/10 bg-emerald-500/[0.08] px-2.5 py-1">
                    <span className="h-[5px] w-[5px] rounded-full bg-emerald-400" />
                    <span className="font-mono text-[10px] text-emerald-400/70">
                      <EditableLabel
                          value={content.editorChrome?.statusLabel}
                          fallback="Live"
                          onChange={(v) => handleChromeUpdate("statusLabel", v)}
                        />
                    </span>
                  </div>
                </div>

                {/* Image content */}
                <div className="relative max-h-[200px] overflow-hidden sm:max-h-none">
                  <EditableMedia
                    image={content.image}
                    imageAlt={content.imageAlt}
                    videoUrl={content.videoUrl}
                    onImageChange={(src, alt) => {
                      handleContentUpdate("image", src);
                      handleContentUpdate("imageAlt", alt);
                    }}
                    onVideoChange={(url) => handleContentUpdate("videoUrl", url)}
                    className="w-full"
                    aspectRatio="video"
                    placeholder="Click to add hero image or video"
                    lockedAspectRatio="16:9"
                    recommendedAspectRatio="16:9"
                    sectionContext={{
                      sectionType: "hero-code-tech",
                      headline: content.headline,
                      description: content.description,
                      badge: content.badge,
                    }}
                  />
                </div>

                {/* Editor footer */}
                <div className="flex items-center justify-between border-t border-border/20 px-3 py-2 font-mono text-[10px] text-muted-foreground/60 sm:px-4 sm:py-2.5 sm:text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span className="h-[6px] w-[6px] rounded-full bg-emerald-400/70" />
                    <EditableLabel
                          value={content.editorChrome?.host}
                          fallback="localhost:3000"
                          onChange={(v) => handleChromeUpdate("host", v)}
                        />
                  </div>
                  <span>
                    <EditableLabel
                          value={content.editorChrome?.statusLine}
                          fallback="No errors · 0 warnings"
                          onChange={(v) => handleChromeUpdate("statusLine", v)}
                        />
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Code ticker.
          Edit mode renders the list ONCE, static and wrapping, with per-item
          text inputs and add/remove controls, the marquee duplicates the array
          for a seamless loop, and editing a scrolling duplicate is unusable. */}
      {isEditMode ? (
        <div className="relative z-10 mt-auto overflow-hidden border-t border-border/10 bg-muted/5 py-3">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2 px-4 font-mono text-[11px] text-muted-foreground/60 sm:px-8 sm:text-[12px] lg:px-14">
            <EditableStringList
              items={content.codeTickerItems}
              onChange={(next) => handleContentUpdate("codeTickerItems", next)}
              newItemValue="npm run build"
              addLabel="+ Add code line"
              placeholder="const app = express()"
              renderItem={(node, i) => <span key={i}>{node}</span>}
            />
          </div>
        </div>
      ) : (
        content.codeTickerItems &&
        content.codeTickerItems.length > 0 && (
          <div className="relative z-10 mt-auto overflow-hidden border-t border-border/10 bg-muted/5 py-3">
            <div
              className="flex gap-10 whitespace-nowrap font-mono text-[11px] text-muted-foreground/50 sm:gap-12 sm:text-[12px] sm:text-muted-foreground/45"
              style={{ animation: "heroCodeTechScroll 30s linear infinite" }}
            >
              {[...content.codeTickerItems, ...content.codeTickerItems].map(
                (item, i) => (
                  <span key={i}>{item}</span>
                ),
              )}
            </div>
          </div>
        )
      )}

      {/* Stats bar */}
      {content.stats && content.stats.length > 0 && (
        <div className="relative z-10 border-t border-border/15 bg-muted/5">
          <div className="mx-auto max-w-[1360px] px-4 py-3 sm:px-8 sm:py-4 lg:px-14">
            <div className="flex flex-wrap items-center justify-center gap-y-3 sm:justify-between">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 sm:justify-start sm:gap-x-12 sm:gap-y-0">
              {content.stats.map((stat, index) => (
                <div key={stat.id} className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-[20px] font-bold text-foreground sm:text-[28px]">
                    {stat.prefix}
                    {isEditMode ? (
                      <EditableText
                        value={stat.value}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = { ...newStats[index], value };
                          handleContentUpdate("stats", newStats);
                        }}
                        styleKey={`stat_${index}_value`}
                        style={content.textStyles?.[`stat_${index}_value`]}
                        onStyleChange={(s) => handleTextStyleChange(`stat_${index}_value`, s)}
                        className="inline"
                        inline
                      />
                    ) : (
                      stat.value
                    )}
                    {stat.suffix}
                  </span>
                  <span className="max-w-[80px] text-[10px] font-medium uppercase leading-tight tracking-wider text-muted-foreground/70 sm:max-w-none sm:text-[11px]">
                    {isEditMode ? (
                      <EditableText
                        value={stat.label}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = { ...newStats[index], label: value };
                          handleContentUpdate("stats", newStats);
                        }}
                        styleKey={`stat_${index}_label`}
                        style={content.textStyles?.[`stat_${index}_label`]}
                        onStyleChange={(s) => handleTextStyleChange(`stat_${index}_label`, s)}
                      />
                    ) : (
                      stat.label
                    )}
                  </span>
                  {index < (content.stats?.length || 0) - 1 && (
                    <div className="ml-4 hidden h-6 w-px bg-border/40 sm:block" />
                  )}
                </div>
              ))}
              </div>

              {content.featuredIn && content.featuredIn.length > 0 && (
                <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-start sm:gap-4">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
                    <EditableLabel
                      value={content.featuredInLabel}
                      fallback="Featured in"
                      onChange={(v) => handleContentUpdate("featuredInLabel", v)}
                      styleKey="featuredInLabel"
                      style={content.textStyles?.featuredInLabel}
                      onStyleChange={(s) => handleTextStyleChange("featuredInLabel", s)}
                    />
                  </span>
                  {content.featuredIn.map((item, index) => (
                    <span
                      key={item.id}
                      className="text-[12px] font-bold tracking-wide text-muted-foreground/80 sm:text-[13px]"
                    >
                      {isEditMode ? (
                        <EditableText
                          value={item.name}
                          onChange={(value) => {
                            const newItems = [...(content.featuredIn || [])];
                            newItems[index] = { ...newItems[index], name: value };
                            handleContentUpdate("featuredIn", newItems);
                          }}
                          styleKey={`featuredIn_${index}`}
                          style={content.textStyles?.[`featuredIn_${index}`]}
                          onStyleChange={(s) => handleTextStyleChange(`featuredIn_${index}`, s)}
                        />
                      ) : (
                        item.name
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes heroCodeTechScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes heroBgOrb1 {
          0%,100% { transform: translate(0,   0)   scale(1);    }
          33%     { transform: translate(4%,  3%)  scale(1.06); }
          66%     { transform: translate(-3%, 6%)  scale(0.94); }
        }
        @keyframes heroBgOrb2 {
          0%,100% { transform: translate(0,   0)   scale(1);    }
          33%     { transform: translate(-5%, 4%)  scale(1.08); }
          66%     { transform: translate(4%, -3%)  scale(0.96); }
        }
        @keyframes heroBgGlow {
          0%   { opacity: 0.5; transform: scaleX(0.75) translateX(-8%); }
          100% { opacity: 1;   transform: scaleX(1.1)  translateX(4%);  }
        }
        @keyframes heroStarTwinkle {
          0%,100% { opacity: 0.45; transform: scale(1);   }
          50%     { opacity: 0.9;  transform: scale(1.4); }
        }
      ` }} />
    </section>
  );
}

// ── Inline SVG icons (no hardcoded colors, use CSS vars) ──

function ArrowIcon() {
  return (
    <svg className="h-[18px] w-[18px] opacity-60" fill="none" viewBox="0 0 20 20">
      <path d="M4 10h12m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4 opacity-50" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4 2.5v11l9-5.5L4 2.5z" />
    </svg>
  );
}


function TechLogoIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();

  if (lower === "react") {
    return (
      <svg className="h-5 w-5 opacity-40 transition-opacity group-hover:opacity-90" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.2" fill="hsl(var(--primary))" />
        <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="hsl(var(--primary))" strokeWidth="0.8" />
        <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="hsl(var(--primary))" strokeWidth="0.8" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="hsl(var(--primary))" strokeWidth="0.8" transform="rotate(120 12 12)" />
      </svg>
    );
  }
  if (lower === "typescript") {
    return (
      <svg className="h-5 w-5 opacity-40 transition-opacity group-hover:opacity-90" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="2" fill="hsl(var(--primary))" />
        <path d="M13.5 16.5v-2.25h-3V11h7v3.25h-3v5.25h-1V16.5z" fill="hsl(var(--primary-foreground))" opacity="0.9" />
        <path d="M7 11h5v1.25H7z" fill="hsl(var(--primary-foreground))" opacity="0.9" />
      </svg>
    );
  }
  if (lower === "node.js" || lower === "nodejs") {
    return (
      <svg className="h-5 w-5 opacity-40 transition-opacity group-hover:opacity-90" viewBox="0 0 24 24">
        <path d="M12 2l9 5.2v10.4L12 22l-9-5.4V7.2L12 2z" fill="hsl(var(--primary))" />
        <path d="M12 7v10" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <path d="M8.5 9l3.5 2 3.5-2" stroke="hsl(var(--primary-foreground))" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
      </svg>
    );
  }
  if (lower === "python") {
    return (
      <svg className="h-5 w-5 opacity-40 transition-opacity group-hover:opacity-90" viewBox="0 0 24 24">
        <path d="M12 2c-3 0-5 1.5-5 4v2h5v1H6c-2.5 0-4 2-4 5s1.5 5 4 5h2v-3c0-2 1.5-4 4-4h5c2 0 3-1 3-3V6c0-2-1.5-4-5-4zm-2.5 2.5a1 1 0 110 2 1 1 0 010-2z" fill="hsl(var(--primary))" />
        <path d="M12 22c3 0 5-1.5 5-4v-2h-5v-1h6c2.5 0 4-2 4-5s-1.5-5-4-5h-2v3c0 2-1.5 4-4 4H7c-2 0-3 1-3 3v4c0 2 1.5 4 5 4zm2.5-2.5a1 1 0 110-2 1 1 0 010 2z" fill="hsl(var(--primary) / 0.6)" />
      </svg>
    );
  }

  // Generic fallback
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[8px] font-bold text-primary/60 opacity-40 transition-opacity group-hover:opacity-90">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import {
  Activity,
  ArrowRight,
  Brush,
  Briefcase,
  ChefHat,
  Disc3,
  Languages,
  LineChart,
  MessageCircle,
  Palette,
  Play,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/**
 * A parameterized bespoke hero. Each `variant` renders a genuinely distinct
 * visual treatment (background, animated decorations, layout) while sharing the
 * editable headline / description / CTA / stats machinery. All motion is gated
 * off in edit mode. Theme colors come from HSL CSS vars so tenant branding wins.
 */
export type BespokeHeroVariant =
  | "arts"
  | "arts-alt"
  | "kids"
  | "kids-alt"
  | "finance"
  | "finance-alt"
  | "language"
  | "language-alt"
  | "skills"
  | "cooking-alt"
  | "fitness-alt"
  | "music-alt"
  | "business-alt"
  | "arts-v3"
  | "kids-v3"
  | "finance-v3";

interface EyebrowCfg {
  icon: ReactNode;
  text: string;
}

const EYEBROW: Record<BespokeHeroVariant, EyebrowCfg> = {
  arts: { icon: <Palette className="h-4 w-4" />, text: "Handmade & Creative" },
  "arts-alt": { icon: <Brush className="h-4 w-4" />, text: "The Maker's Studio" },
  kids: { icon: <Sparkles className="h-4 w-4" />, text: "Learning Made Fun" },
  "kids-alt": { icon: <Star className="h-4 w-4" />, text: "For Little Explorers" },
  finance: { icon: <TrendingUp className="h-4 w-4" />, text: "Markets & Wealth" },
  "finance-alt": { icon: <LineChart className="h-4 w-4" />, text: "Trade Smarter" },
  language: { icon: <Languages className="h-4 w-4" />, text: "Speak The World" },
  "language-alt": { icon: <MessageCircle className="h-4 w-4" />, text: "Real Conversations" },
  skills: { icon: <Rocket className="h-4 w-4" />, text: "Future-Ready Skills" },
  "cooking-alt": { icon: <ChefHat className="h-4 w-4" />, text: "From The Kitchen" },
  "fitness-alt": { icon: <Activity className="h-4 w-4" />, text: "Move With Purpose" },
  "music-alt": { icon: <Disc3 className="h-4 w-4" />, text: "Press Play" },
  "business-alt": { icon: <Briefcase className="h-4 w-4" />, text: "Enterprise Learning" },
  "arts-v3": { icon: <Palette className="h-4 w-4" />, text: "Where Ideas Take Shape" },
  "kids-v3": { icon: <Sparkles className="h-4 w-4" />, text: "Big Fun, Little Steps" },
  "finance-v3": { icon: <TrendingUp className="h-4 w-4" />, text: "Build Your Wealth" },
};

const IMMERSIVE = new Set<BespokeHeroVariant>([
  "arts-alt",
  "kids-alt",
  "finance-alt",
  "language-alt",
  "cooking-alt",
  "business-alt",
  "arts-v3",
  "kids-v3",
  "finance-v3",
]);

const UPPERCASE = new Set<BespokeHeroVariant>([
  "finance",
  "finance-alt",
  "fitness-alt",
  "business-alt",
  "finance-v3",
]);

interface BespokeHeroProps {
  section: SectionConfig;
  variant: BespokeHeroVariant;
}

export function BespokeHero({ section, variant }: BespokeHeroProps) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } =
    useSectionEditor();

  const resolveHref = (href: string) => (!href || href.startsWith("#") ? "/all-courses" : href);
  const update = (key: keyof HeroPhotographyContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const stats = content.stats ?? [];
  const immersive = IMMERSIVE.has(variant);
  const uppercase = UPPERCASE.has(variant);
  const eyebrow = EYEBROW[variant];
  const enter = (i: number): CSSProperties =>
    isEditMode ? {} : { animation: "bhFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 0.1}s` };

  const textColor = immersive ? "text-white" : "";
  const headStyle: CSSProperties = immersive ? { color: "#fff" } : { color: "hsl(var(--foreground))" };
  const descColorClass = immersive ? "text-white/90" : "";
  const descColorStyle: CSSProperties = immersive ? {} : { color: "hsl(var(--muted-foreground))" };

  const eyebrowNode = (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${uppercase ? "uppercase tracking-wider" : ""}`}
      style={
        immersive
          ? { backgroundColor: "hsl(var(--primary) / 0.9)", color: "#fff", ...enter(0) }
          : { backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", ...enter(0) }
      }
    >
      {eyebrow.icon}
      <EditableText value={content.eyebrow ?? eyebrow.text} onChange={(v) => update("eyebrow", v)} as="span" />
    </span>
  );

  const headlineNode = (
    <h1
      className={`mt-5 break-words text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl ${uppercase ? "uppercase" : ""} ${textColor}`}
      style={{ ...headStyle, ...enter(1) }}
    >
      <EditableText
        value={content.headline}
        onChange={(v) => update("headline", v)}
        as="span"
        styleKey="headline"
        style={content.textStyles?.headline}
        onStyleChange={(s) => handleTextStyleChange("headline", s)}
        multiline
      />
    </h1>
  );

  const descNode = (content.description || isEditMode) && (
    <p className={`mt-5 max-w-xl text-lg sm:text-xl ${descColorClass}`} style={{ ...descColorStyle, ...enter(2) }}>
      <EditableText
        value={content.description || ""}
        onChange={(v) => update("description", v)}
        as="span"
        placeholder="Add a compelling subtitle..."
        styleKey="description"
        style={content.textStyles?.description}
        onStyleChange={(s) => handleTextStyleChange("description", s)}
      />
    </p>
  );

  const ctasNode = (
    <div
      className={`mt-8 flex flex-wrap gap-4 ${immersive ? "justify-center" : ""}`}
      style={enter(3)}
    >
      {content.primaryCta && !content.primaryCta.hidden && (
        <EditableClickable
          href={content.primaryCta.href}
          onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })}
          hidden={content.primaryCta.hidden}
          onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })}
          isEditing={isEditMode}
          slotLabel="Primary Button"
        >
          <button
            type="button"
            className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-xl transition-transform hover:scale-105"
            style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            {isEditMode ? (
              <>
                <EditableText
                  value={content.primaryCta.text}
                  onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                  as="span"
                  styleKey="primaryCta"
                  style={content.textStyles?.primaryCta}
                  onStyleChange={(s) => handleTextStyleChange("primaryCta", s)}
                />
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                {content.primaryCta.text}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </LinkComponent>
            )}
          </button>
        </EditableClickable>
      )}
      {content.secondaryCta && !content.secondaryCta.hidden && (
        <EditableClickable
          href={content.secondaryCta.href}
          onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })}
          hidden={content.secondaryCta.hidden}
          onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })}
          isEditing={isEditMode}
          slotLabel="Secondary Button"
        >
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border-2 px-8 py-4 text-base font-bold transition-colors ${immersive ? "border-white text-white hover:bg-white/10" : ""}`}
            style={immersive ? undefined : { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}
          >
            <Play className="h-5 w-5" />
            {isEditMode ? (
              <EditableText
                value={content.secondaryCta.text}
                onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                as="span"
                styleKey="secondaryCta"
                style={content.textStyles?.secondaryCta}
                onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
              />
            ) : (
              <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
            )}
          </button>
        </EditableClickable>
      )}
    </div>
  );

  const statsNode = stats.length > 0 && (
    <div
      className={`mt-12 flex flex-wrap gap-x-10 gap-y-6 ${immersive ? "justify-center" : ""}`}
      style={enter(4)}
    >
      {stats.map((stat: HeroPhotographyStat, i: number) => (
        <div key={stat.id}>
          <div className={`text-3xl font-extrabold sm:text-4xl ${textColor}`} style={immersive ? { color: "#fff" } : { color: "hsl(var(--primary))" }}>
            <EditableText
              value={stat.value}
              onChange={(v) => {
                const next = [...stats];
                next[i] = { ...next[i], value: v };
                update("stats", next);
              }}
              as="span"
            />
          </div>
          <div className={`text-sm font-semibold ${immersive ? "text-white/70" : ""}`} style={immersive ? {} : { color: "hsl(var(--muted-foreground))" }}>
            <EditableText
              value={stat.label}
              onChange={(v) => {
                const next = [...stats];
                next[i] = { ...next[i], label: v };
                update("stats", next);
              }}
              as="span"
            />
          </div>
        </div>
      ))}
    </div>
  );

  const textBlock = (
    // min-w-0 lets the text grid column shrink to its 1fr share instead of its
    // (huge headline) min-content width, without it the column overflows the
    // grid and the headline slides under the image column on the live/preview
    // render (the editor's contentEditable happens to wrap, hiding the bug).
    <div className={immersive ? "max-w-2xl" : "min-w-0"}>
      {eyebrowNode}
      {headlineNode}
      {descNode}
      {ctasNode}
      {statsNode}
    </div>
  );

  const imageEditor = isEditMode && (
    <div className="absolute bottom-6 right-6 z-30 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
      <EditableImage
        src={content.image || ""}
        alt={content.imageAlt || "Hero image"}
        onChange={(src) => update("image", src)}
        className="h-full w-full"
        aspectRatio="square"
        placeholder="IMG"
      />
    </div>
  );

  const paused = isEditMode;

  if (immersive) {
    return (
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        <HeroKeyframes />
        <ImmersiveBackground variant={variant} image={content.image} imageAlt={content.imageAlt} paused={paused} />
        {imageEditor}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto flex flex-col items-center">{textBlock}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
      <HeroKeyframes />
      <SplitBackdrop variant={variant} paused={paused} />
      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        {textBlock}
        <div className="relative">
          <SplitVisual variant={variant} image={content.image} imageAlt={content.imageAlt} paused={paused} />
          {imageEditor}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shared keyframes                                                    */
/* ------------------------------------------------------------------ */
function HeroKeyframes() {
  return (
    <style>{`
      @keyframes bhFadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
      @keyframes bhFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
      @keyframes bhFloatX { 0%,100% { transform: translate(0,0); } 50% { transform: translate(10px,-12px); } }
      @keyframes bhSpin { to { transform: rotate(360deg); } }
      @keyframes bhSpinSlow { to { transform: rotate(-360deg); } }
      @keyframes bhOrbit { to { transform: rotate(360deg); } }
      @keyframes bhPulse { 0%,100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.35); opacity: 0; } }
      @keyframes bhBars { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
      @keyframes bhSteam { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 40% { opacity: 0.7; } 100% { opacity: 0; transform: translateY(-42px) scaleX(1.5); } }
      @keyframes bhDash { to { stroke-dashoffset: -1000; } }
      @keyframes bhBob { 0%,100% { transform: translateY(0) rotate(var(--bhr,0deg)); } 50% { transform: translateY(-12px) rotate(var(--bhr,0deg)); } }
      @keyframes bhBeat { 0%,60%,100% { transform: scaleY(1); } 20% { transform: scaleY(2.1); } 40% { transform: scaleY(0.5); } }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Immersive backgrounds (full-bleed)                                  */
/* ------------------------------------------------------------------ */
function ImmersiveBackground({
  variant,
  image,
  imageAlt,
  paused,
}: {
  variant: BespokeHeroVariant;
  image?: string;
  imageAlt?: string;
  paused: boolean;
}) {
  // Common: image (if any) + strong overlay so centered text is readable.
  const overlay =
    variant === "kids-alt" || variant === "kids-v3"
      ? "linear-gradient(160deg, hsl(var(--primary) / 0.92), hsl(var(--accent) / 0.75))"
      : variant === "arts-v3"
        ? "linear-gradient(160deg, hsl(var(--primary) / 0.85), hsl(var(--accent) / 0.7))"
        : "linear-gradient(180deg, rgba(6,10,20,0.72), rgba(6,10,20,0.86))";

  return (
    <div className="absolute inset-0 z-0">
      {image ? (
        <img src={image} alt={imageAlt || "Hero background"} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
      )}
      <div className="absolute inset-0" style={{ background: overlay }} />

      {variant === "arts-alt" && <GalleryWall paused={paused} />}
      {variant === "kids-alt" && <Balloons paused={paused} />}
      {variant === "finance-alt" && <Candles paused={paused} />}
      {variant === "language-alt" && <WordCloud paused={paused} />}
      {variant === "cooking-alt" && <Steam paused={paused} />}
      {variant === "business-alt" && <DottedMap paused={paused} />}
      {variant === "arts-v3" && <PaintSplashes paused={paused} />}
      {variant === "kids-v3" && <Confetti paused={paused} />}
      {variant === "finance-v3" && <GrowthArcs paused={paused} />}
    </div>
  );
}

/* New signature decorations for the v3 hero variants. */
function PaintSplashes({ paused }: { paused: boolean }) {
  const blobs = [
    { l: "10%", t: "18%", s: 120, d: 0 },
    { l: "72%", t: "12%", s: 150, d: 0.7 },
    { l: "20%", t: "64%", s: 96, d: 1.2 },
    { l: "80%", t: "58%", s: 132, d: 0.4 },
    { l: "48%", t: "30%", s: 80, d: 0.9 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full mix-blend-screen blur-2xl"
          style={{
            left: b.l,
            top: b.t,
            width: b.s,
            height: b.s,
            backgroundColor:
              i % 2 ? "hsl(var(--accent) / 0.6)" : "hsl(var(--primary) / 0.55)",
            animation: paused ? undefined : `bhFloatX ${6 + i}s ease-in-out ${b.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Confetti({ paused }: { paused: boolean }) {
  const bits = Array.from({ length: 22 }, (_, i) => ({
    l: `${(i * 4.6 + (i % 3) * 3) % 100}%`,
    d: (i % 7) * 0.4,
    dur: 5 + (i % 5),
    s: 8 + (i % 4) * 3,
    r: i % 2 ? 12 : -12,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((c, i) => (
        <span
          key={i}
          className="absolute top-[-6%] rounded-sm"
          style={{
            left: c.l,
            width: c.s,
            height: c.s,
            ["--bhr" as string]: `${c.r}deg`,
            backgroundColor:
              i % 3 === 0
                ? "hsl(var(--primary))"
                : i % 3 === 1
                  ? "hsl(var(--accent))"
                  : "#fff",
            animation: paused ? undefined : `bhBob ${c.dur}s ease-in-out ${c.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function GrowthArcs({ paused }: { paused: boolean }) {
  const arcs = [0, 1, 2, 3];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute bottom-[-40%] right-[-10%] h-[120%] w-[70%]">
        {arcs.map((a) => (
          <span
            key={a}
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: "hsl(var(--accent) / 0.35)",
              transform: `scale(${0.55 + a * 0.16})`,
              animation: paused ? undefined : `bhPulse ${4 + a}s ease-in-out ${a * 0.5}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-[8%] flex items-end gap-2 opacity-60">
        {[0.4, 0.7, 0.5, 0.9, 0.65, 1].map((h, i) => (
          <span
            key={i}
            className="w-3 rounded-t-sm"
            style={{
              height: `${h * 120}px`,
              backgroundColor: "hsl(var(--primary))",
              transformOrigin: "bottom",
              animation: paused ? undefined : `bhBars ${2.4 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function GalleryWall({ paused }: { paused: boolean }) {
  const spots = [
    { l: "8%", t: "14%", s: 92, d: 0 },
    { l: "78%", t: "10%", s: 76, d: 0.6 },
    { l: "14%", t: "62%", s: 84, d: 1.1 },
    { l: "82%", t: "60%", s: 96, d: 0.3 },
    { l: "46%", t: "8%", s: 64, d: 0.9 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {spots.map((sp, i) => (
        <span
          key={i}
          className="absolute rounded-md border-4 border-white/25 bg-white/10 shadow-2xl backdrop-blur-sm"
          style={{
            left: sp.l,
            top: sp.t,
            width: sp.s,
            height: sp.s,
            transform: `rotate(${i % 2 ? 6 : -6}deg)`,
            animation: paused ? undefined : `bhFloat ${5 + i}s ease-in-out ${sp.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Balloons({ paused }: { paused: boolean }) {
  const colors = ["#fef08a", "#fca5a5", "#a5b4fc", "#6ee7b7", "#f9a8d4"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[10, 26, 48, 68, 86].map((l, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${l}%`,
            top: `${12 + (i % 3) * 18}%`,
            width: 40 + (i % 3) * 14,
            height: 50 + (i % 3) * 16,
            backgroundColor: colors[i % colors.length],
            opacity: 0.85,
            animation: paused ? undefined : `bhFloat ${4 + i}s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Candles({ paused }: { paused: boolean }) {
  const bars = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center gap-2 overflow-hidden px-8 opacity-60">
      {bars.map((_, i) => {
        const up = i % 3 !== 1;
        const h = 20 + ((i * 37) % 60);
        return (
          <span
            key={i}
            className="w-3 rounded-sm"
            style={{
              height: `${h}%`,
              backgroundColor: up ? "hsl(var(--primary))" : "hsl(var(--accent))",
              transformOrigin: "bottom",
              animation: paused ? undefined : `bhBars ${2.4 + (i % 5) * 0.3}s ease-in-out ${i * 0.12}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function WordCloud({ paused }: { paused: boolean }) {
  const words = ["Hola", "Bonjour", "こんにちは", "नमस्ते", "Ciao", "안녕", "Olá", "Hallo"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {words.map((w, i) => (
        <span
          key={w}
          className="absolute rounded-full bg-white/12 px-4 py-1.5 text-sm font-semibold text-white/80 backdrop-blur"
          style={{
            left: `${8 + ((i * 23) % 82)}%`,
            top: `${10 + ((i * 31) % 74)}%`,
            animation: paused ? undefined : `bhFloatX ${5 + (i % 4)}s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          {w}
        </span>
      ))}
    </div>
  );
}

function Steam({ paused }: { paused: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[30, 50, 70].map((l, i) => (
        <span
          key={i}
          className="absolute bottom-1/3 w-1.5 rounded-full bg-white/40"
          style={{
            left: `${l}%`,
            height: 60,
            filter: "blur(3px)",
            animation: paused ? undefined : `bhSteam ${3 + i * 0.6}s ease-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function DottedMap({ paused }: { paused: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(70% 60% at 50% 45%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 45%, black, transparent 75%)",
        }}
      />
      {[20, 40, 60, 80].map((l, i) => (
        <span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full"
          style={{
            left: `${l}%`,
            top: `${30 + (i % 2) * 26}%`,
            backgroundColor: "hsl(var(--accent))",
            boxShadow: "0 0 0 6px hsl(var(--accent) / 0.25)",
            animation: paused ? undefined : `bhPulse 2.8s ease-out ${i * 0.5}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split layout, soft backdrop + right-side visual                    */
/* ------------------------------------------------------------------ */
function SplitBackdrop({ variant, paused }: { variant: BespokeHeroVariant; paused: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)", animation: paused ? undefined : "bhFloat 9s ease-in-out infinite" }}
      />
      <div
        className="absolute -right-16 bottom-0 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.16), transparent 70%)", animation: paused ? undefined : "bhFloatX 11s ease-in-out infinite" }}
      />
      {variant === "kids" && (
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(hsl(var(--accent) / 0.35) 2px, transparent 2px)", backgroundSize: "34px 34px" }}
        />
      )}
    </div>
  );
}

function SplitVisual({
  variant,
  image,
  imageAlt,
  paused,
}: {
  variant: BespokeHeroVariant;
  image?: string;
  imageAlt?: string;
  paused: boolean;
}) {
  const rounded = variant === "kids" ? "rounded-[2.5rem]" : "rounded-3xl";
  return (
    <div className="relative isolate mx-auto aspect-[4/3] w-full max-w-xl">
      {/* Decoration layer behind image */}
      {variant === "skills" && <OrbitRing paused={paused} />}
      {variant === "finance" && <ChartCurve paused={paused} />}
      {variant === "fitness-alt" && <PulseLine paused={paused} />}
      {variant === "music-alt" && <Vinyl paused={paused} />}
      {variant === "language" && <SpeechBubbles paused={paused} />}
      {variant === "arts" && <PaintBlobs paused={paused} />}

      {/* Image frame */}
      <div
        className={`absolute inset-6 z-10 overflow-hidden ${rounded} shadow-2xl`}
        style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted))", animation: paused ? undefined : "bhFloat 6s ease-in-out infinite" }}
      >
        {image ? (
          <img src={image} alt={imageAlt || "Hero image"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Star className="h-10 w-10" />
          </div>
        )}
      </div>
    </div>
  );
}

function OrbitRing({ paused }: { paused: boolean }) {
  const icons = [Rocket, Star, Sparkles, TrendingUp];
  // Sits BEHIND the image (z-0); icons ride the image's edge so half peeks out
  // from behind the frame, forming a subtle surrounding ring. Never overflows
  // the container because the orbit box matches the image bounds (inset-6).
  return (
    <div
      className="pointer-events-none absolute inset-6 z-0"
      style={{ animation: paused ? undefined : "bhOrbit 26s linear infinite" }}
    >
      {icons.map((Icon, i) => {
        const angle = (i / icons.length) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + 50 * Math.cos(angle);
        const y = 50 + 50 * Math.sin(angle);
        return (
          <span
            key={i}
            className="absolute flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%,-50%)",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--primary))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <Icon className="h-5 w-5" />
          </span>
        );
      })}
    </div>
  );
}

function ChartCurve({ paused }: { paused: boolean }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polyline
        points="4,80 22,60 38,68 54,38 70,48 86,18 96,24"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 6"
        style={{ animation: paused ? undefined : "bhDash 18s linear infinite" }}
      />
    </svg>
  );
}

function PulseLine({ paused }: { paused: boolean }) {
  return (
    <div className="absolute inset-x-0 top-1/2 flex h-16 items-center gap-1 px-2">
      {Array.from({ length: 22 }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full"
          style={{ height: 8, backgroundColor: "hsl(var(--accent))", transformOrigin: "center", animation: paused ? undefined : `bhBeat 1.6s ease-in-out ${i * 0.06}s infinite` }}
        />
      ))}
    </div>
  );
}

function Vinyl({ paused }: { paused: boolean }) {
  return (
    <div
      className="absolute right-2 top-2 h-28 w-28 rounded-full"
      style={{
        background: "repeating-radial-gradient(circle at center, hsl(var(--foreground)) 0 3px, hsl(var(--muted-foreground)) 3px 6px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        animation: paused ? undefined : "bhSpin 6s linear infinite",
      }}
    >
      <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
    </div>
  );
}

function SpeechBubbles({ paused }: { paused: boolean }) {
  const words = ["Hola", "Bonjour", "नमस्ते"];
  return (
    <>
      {words.map((w, i) => (
        <span
          key={w}
          className="absolute z-20 rounded-2xl px-3 py-1.5 text-sm font-bold shadow-lg"
          style={{
            left: i === 0 ? "-4%" : i === 1 ? "70%" : "8%",
            top: i === 0 ? "6%" : i === 1 ? "44%" : "84%",
            backgroundColor: "hsl(var(--card))",
            color: "hsl(var(--primary))",
            border: "1px solid hsl(var(--border))",
            animation: paused ? undefined : `bhFloat ${4 + i}s ease-in-out ${i * 0.5}s infinite`,
          }}
        >
          {w}
        </span>
      ))}
    </>
  );
}

function PaintBlobs({ paused }: { paused: boolean }) {
  const colors = ["#f472b6", "#facc15", "#34d399"];
  return (
    <>
      {colors.map((c, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-70"
          style={{
            left: i === 0 ? "-2%" : i === 1 ? "76%" : "60%",
            top: i === 0 ? "4%" : i === 1 ? "8%" : "80%",
            width: 60 - i * 8,
            height: 60 - i * 8,
            backgroundColor: c,
            filter: "blur(2px)",
            animation: paused ? undefined : `bhFloatX ${5 + i}s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </>
  );
}

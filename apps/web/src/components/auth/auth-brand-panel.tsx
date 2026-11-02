"use client";

import {
  GraduationCap,
  Mic,
  MessageSquare,
  FileText,
  Video,
  BookOpen,
  Sparkles,
  Brain,
  Award,
  Users,
  Rocket,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import type { LoginFormContent } from "@open-mtlms/shared";
import { normalizeLoginBrandFeatures, decodeHtmlEntities } from "@open-mtlms/shared";
import type { TenantInfo } from "@/lib/api/auth";
import { EditableText } from "@/components/view-components";

export const DEFAULT_TAGLINE =
  "Your personalized learning platform with courses, AI tools, and more.";

/** Lucide name → component, for the curated login feature icon set. */
const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  Mic,
  MessageSquare,
  FileText,
  Video,
  BookOpen,
  Sparkles,
  Brain,
  Award,
  Users,
  Rocket,
  PenTool,
};

interface AuthBrandPanelProps {
  tenantInfo?: TenantInfo | null;
  /** Editable left-panel content (split variant). */
  tagline?: string;
  /** Stored brand features (legacy string[] or {icon,text}[]), normalized here. */
  features?: LoginFormContent["brandFeatures"];
  isEditMode?: boolean;
  onTaglineChange?: (value: string) => void;
  onFeatureChange?: (index: number, value: string) => void;
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <div className="auth-feature-row flex items-center gap-3 rounded-xl border border-primary-foreground/[0.15] bg-primary-foreground/[0.10] px-4 py-3 backdrop-blur-sm transition-colors duration-300 hover:bg-primary-foreground/[0.18]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/[0.15]">
        {icon}
      </div>
      <span className="text-sm font-semibold text-primary-foreground">{text}</span>
    </div>
  );
}

export function AuthBrandPanel({
  tenantInfo,
  tagline,
  features,
  isEditMode = false,
  onTaglineChange,
  onFeatureChange,
}: AuthBrandPanelProps) {
  // Editable text round-trips through the builder's contentEditable, which can
  // HTML-encode "&" → "&amp;". Decode on render so the live panel shows "&".
  const taglineText = decodeHtmlEntities(tagline ?? DEFAULT_TAGLINE);
  const featureList = normalizeLoginBrandFeatures(features).map((f) => ({
    ...f,
    text: decodeHtmlEntities(f.text),
  }));
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/70">

      {/* Decorative animations are skipped in the builder (edit mode) for a clean canvas. */}
      {!isEditMode && (
        <>
      {/* ── Animated grid pattern ── */}
      <div
        className="auth-grid absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      {/* ── Dot pattern overlay ── */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* ── Center radial glow ── */}
      <div className="auth-glow pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] rounded-full bg-white blur-[140px]" />

      {/* ── Floating orbs ── */}
      <div className="auth-drift-1 absolute -left-12 top-[10%] h-[240px] w-[240px] rounded-full border border-white/[0.12] bg-white/[0.04]" />
      <div className="auth-drift-2 absolute -right-20 top-[32%] h-[320px] w-[320px] rounded-full border border-white/[0.10]" />
      <div className="auth-drift-3 absolute bottom-[6%] left-[12%] h-[180px] w-[180px] rounded-full border border-white/[0.14] bg-white/[0.05]" />
      <div className="auth-drift-2-delayed absolute right-[22%] top-[4%] h-[130px] w-[130px] rounded-full bg-white/[0.06]" />
      <div className="auth-drift-1-delayed absolute bottom-[22%] left-[58%] h-[90px] w-[90px] rounded-full bg-white/[0.08]" />

      {/* ── Small twinkling dots ── */}
      <div className="auth-twinkle-1 absolute left-[28%] top-[18%] h-1.5 w-1.5 rounded-full bg-white/40" />
      <div className="auth-twinkle-2 absolute right-[18%] top-[58%] h-2 w-2 rounded-full bg-white/30" />
      <div className="auth-twinkle-3 absolute left-[65%] top-[72%] h-1.5 w-1.5 rounded-full bg-white/35" />
      <div className="auth-twinkle-1 absolute left-[15%] top-[55%] h-1 w-1 rounded-full bg-white/45" />
      <div className="auth-twinkle-2 absolute right-[35%] top-[88%] h-1.5 w-1.5 rounded-full bg-white/30" />
        </>
      )}

      {/* ── Brand content ── */}
      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        {/* Tenant logo in rounded white container */}
        {tenantInfo?.logoUrl ? (
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tenantInfo.logoUrl}
              alt={tenantInfo.name}
              className="h-20 w-20 object-contain"
            />
          </div>
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-primary-foreground/[0.15] backdrop-blur-sm">
            <GraduationCap className="h-14 w-14 text-primary-foreground" />
          </div>
        )}

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-sm">
          {tenantInfo?.name || "Welcome Back"}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-primary-foreground/90">
          {isEditMode && onTaglineChange ? (
            <EditableText value={taglineText} onChange={onTaglineChange} />
          ) : (
            taglineText
          )}
        </p>

        {/* ── Feature highlights (icon + text from the DB page config) ── */}
        <div className="mt-10 w-full max-w-xs space-y-2.5">
          {featureList.map((feat, i) => {
            const Icon = ICON_MAP[feat.icon] ?? GraduationCap;
            return (
              <FeatureRow
                key={i}
                icon={<Icon className="h-4 w-4 text-primary-foreground" />}
                text={
                  isEditMode && onFeatureChange ? (
                    <EditableText
                      value={feat.text}
                      onChange={(v) => onFeatureChange(i, v)}
                    />
                  ) : (
                    feat.text
                  )
                }
              />
            );
          })}
        </div>
      </div>

      {/* ── Bottom copyright ── */}
      {tenantInfo && (
        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-primary-foreground/50">
          &copy; {new Date().getFullYear()} {tenantInfo.name}. All rights reserved.
        </p>
      )}
    </div>
  );
}

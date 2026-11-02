"use client";

import {
  hasCustomSectionBackground,
  LOGIN_BRAND_FEATURE_ICONS,
  normalizeLoginBrandFeatures,
  decodeHtmlEntities,
} from "@open-mtlms/shared";
import type {
  SectionConfig,
  LoginFormContent,
  LoginBrandFeatureItem,
} from "@open-mtlms/shared";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Phone,
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
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { useSectionEditor } from "../SectionEditorContext";

/** Lucide name → component, for the curated login feature icon set. */
const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
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

interface LoginFormSectionProps {
  section: SectionConfig;
}

const DEFAULT_TAGLINE =
  "Your personalized learning platform with courses, AI tools, and more.";

type EditableTextComponent = React.ComponentType<{
  value: string;
  onChange: (v: string) => void;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}>;

/* ------------------------------------------------------------------ */
/* Brand panel (LEFT), tagline + feature texts are editable inline    */
/* ------------------------------------------------------------------ */
function BrandPanel({
  content,
  section,
  EditableText,
  updateSectionContent,
  tenantBrand,
}: {
  content: LoginFormContent;
  section: SectionConfig;
  EditableText: EditableTextComponent;
  updateSectionContent: (id: string, content: Record<string, unknown>) => void;
  tenantBrand?: { name?: string | null; logoUrl?: string | null };
}) {
  const brandName = tenantBrand?.name || "Your Academy";
  // Decode any HTML-encoded "&" (the contentEditable round-trip can turn "&"
  // into "&amp;") so the panel shows "&" in the editor and on the live page.
  const tagline = decodeHtmlEntities(content?.brandTagline ?? DEFAULT_TAGLINE);
  const features = normalizeLoginBrandFeatures(content?.brandFeatures).map(
    (f) => ({ ...f, text: decodeHtmlEntities(f.text) }),
  );
  const [iconPickerFor, setIconPickerFor] = useState<number | null>(null);

  const writeFeatures = (next: LoginBrandFeatureItem[]) =>
    updateSectionContent(section.id, { brandFeatures: next });

  const updateFeatureText = (index: number, text: string) =>
    writeFeatures(features.map((f, i) => (i === index ? { ...f, text } : f)));

  const updateFeatureIcon = (index: number, icon: string) => {
    writeFeatures(features.map((f, i) => (i === index ? { ...f, icon } : f)));
    setIconPickerFor(null);
  };

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-8 py-16 text-center">
      {/* Text uses primary-foreground (the theme's contrast color for primary),
          so it stays readable on any tenant palette in light or dark mode. */}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <div className="relative z-10 flex w-full flex-col items-center">
      {/* Tenant logo, non-editable, sourced from tenant context (org details). */}
      {tenantBrand?.logoUrl ? (
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenantBrand.logoUrl}
            alt={brandName}
            className="h-16 w-16 object-contain"
          />
        </div>
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary-foreground/[0.15]">
          <GraduationCap className="h-12 w-12 text-primary-foreground" />
        </div>
      )}
      {/* Tenant name, non-editable, from tenant context. */}
      <h2 className="mt-6 text-3xl font-bold tracking-tight text-primary-foreground drop-shadow-sm">
        {brandName}
      </h2>
      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-primary-foreground/90">
        <EditableText
          value={tagline}
          onChange={(v) => updateSectionContent(section.id, { brandTagline: v })}
          placeholder="Tagline"
          className="text-primary-foreground hover:!bg-primary-foreground/15 focus:!bg-primary-foreground/20"
        />
      </p>

      <div className="mt-10 w-full max-w-xs space-y-2.5">
        {features.map((feat, i) => {
          const Icon = FEATURE_ICON_MAP[feat.icon] ?? GraduationCap;
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-primary-foreground/[0.15] bg-primary-foreground/[0.10] px-4 py-3"
            >
              {/* Icon chip doubles as the picker trigger (editable icon). */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setIconPickerFor(iconPickerFor === i ? null : i)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/[0.15] ring-1 ring-primary-foreground/25 transition-colors hover:bg-primary-foreground/[0.30]"
                  title="Change icon"
                  aria-label="Change feature icon"
                >
                  <Icon className="h-4 w-4 text-primary-foreground" />
                </button>
                {iconPickerFor === i && (
                  <div className="absolute left-0 top-10 z-30 grid w-44 grid-cols-4 gap-1 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
                    {LOGIN_BRAND_FEATURE_ICONS.map((name) => {
                      const Opt = FEATURE_ICON_MAP[name] ?? GraduationCap;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updateFeatureIcon(i, name)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted",
                            feat.icon === name &&
                              "bg-primary/15 ring-1 ring-primary"
                          )}
                          title={name}
                        >
                          <Opt className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="flex-1 text-left text-sm font-semibold text-primary-foreground">
                <EditableText
                  value={feat.text}
                  onChange={(v) => updateFeatureText(i, v)}
                  placeholder="Feature"
                  className="text-primary-foreground hover:!bg-primary-foreground/15 focus:!bg-primary-foreground/20"
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer copyright, non-editable, derived from tenant name. */}
      <p className="mt-10 text-xs text-primary-foreground/50">
        &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
      </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login form (RIGHT), preview only; functionality isn't editable     */
/* ------------------------------------------------------------------ */
function LoginPreview({ content }: { content: LoginFormContent }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
          {content?.headline ?? "Login"}
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
          {content?.subheadline ?? "Sign in to your account"}
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="mt-7 space-y-5">
        <div className="space-y-2">
          <Label className="text-[13px] font-medium text-foreground/80">
            {content?.emailLabel ?? "Email"}
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type="email"
              placeholder={content?.emailPlaceholder ?? "Enter your email"}
              className="h-11 rounded-xl pl-10"
              disabled
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[13px] font-medium text-foreground/80">
              {content?.passwordLabel ?? "Password"}
            </Label>
            <span className="text-[13px] font-medium text-primary">
              {content?.forgotPasswordText ?? "Forgot Password?"}
            </span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={content?.passwordPlaceholder ?? "Enter your password"}
              className="h-11 rounded-xl pl-10 pr-10"
              disabled
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="h-12 w-full rounded-xl" size="lg" disabled>
          {content?.submitText ?? "Sign In"}
        </Button>
      </form>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-widest">
          <span className="bg-background px-4 text-muted-foreground/70">
            {content?.socialHeadline ?? "Or continue with"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground">
          <Mail className="mr-2 h-4 w-4" />
          Sign in with Email OTP
        </div>
        <div className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground">
          <Phone className="mr-2 h-4 w-4" />
          Sign in with WhatsApp OTP
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
        Sign-in options shown are controlled by your auth settings, not editable here.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */
export function LoginFormSection({ section }: LoginFormSectionProps) {
  const { EditableText, updateSectionContent, tenantBrand } = useSectionEditor();
  const content = section.content as LoginFormContent;
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);
  const isMinimal = variant === "minimal";

  // Minimal: just the centered form preview (no brand panel).
  if (isMinimal) {
    return (
      <section
        className={cn(
          "flex min-h-[80vh] items-center justify-center px-4 py-16",
          hasCustomBg ? "bg-transparent" : "bg-background"
        )}
      >
        <LoginPreview content={content} />
      </section>
    );
  }

  // Default + split: live-style split, editable brand panel + form preview.
  return (
    <section className={cn("min-h-[80vh]", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="grid min-h-[80vh] lg:grid-cols-[1fr_1.1fr]">
        <BrandPanel
          content={content}
          section={section}
          EditableText={EditableText}
          updateSectionContent={updateSectionContent}
          tenantBrand={tenantBrand}
        />
        <div className="flex items-center justify-center bg-background px-6 py-12 lg:px-16">
          <LoginPreview content={content} />
        </div>
      </div>
    </section>
  );
}

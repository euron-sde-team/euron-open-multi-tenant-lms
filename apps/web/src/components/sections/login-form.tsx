"use client";

import { hasCustomSectionBackground , normalizeLoginBrandFeatures } from "@open-mtlms/shared";
import type { SectionConfig, LoginFormContent } from "@open-mtlms/shared";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useEditMode } from "@/lib/edit-mode-context";
import { EditableText } from "@/components/view-components";
import { Button, Input, Label } from "@open-mtlms/core";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, Loader2, User, AlertCircle } from "lucide-react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { OtpForm } from "@/components/auth/otp-form";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { trackUserLogin, trackUserSignup } from "@/lib/analytics";
import { userAuthApi, type AuthConfig, type AuthResponse, type TenantInfo } from "@/lib/api/auth";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface LoginFormSectionProps {
  section: SectionConfig;
}

/* ------------------------------------------------------------------ */
/* Auth mode types                                                     */
/* ------------------------------------------------------------------ */
type AuthView =
  | "login"
  | "signup"
  | "email-otp-send"
  | "otp-verify";

/* ------------------------------------------------------------------ */
/* Shared card wrapper classes                                         */
/* ------------------------------------------------------------------ */
const CARD_CLASSES =
  "bg-card text-card-foreground rounded-2xl border border-border/60 p-8 shadow-xl shadow-foreground/[0.03] backdrop-blur-sm sm:p-10";

/* Single border on focus (no ring + offset double-border) */
const INPUT_FOCUS =
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

/* ------------------------------------------------------------------ */
/* Login Form Card (functional auth flow)                              */
/* ------------------------------------------------------------------ */
/**
 * Only same-site paths may come out of `?redirect=`. Anything else, an
 * absolute URL, a protocol-relative `//evil.example`, a backslash variant.
 * would let a crafted login link bounce a fresh session to an attacker's page.
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

function LoginCard({
  content,
  section,
  isEditMode,
  showCard = true,
  hideLogo = false,
}: {
  content: LoginFormContent;
  section: SectionConfig;
  isEditMode: boolean;
  showCard?: boolean;
  hideLogo?: boolean;
}) {
  const { updateSectionContent } = useEditorStore();
  const { login: storeLogin } = useUserAuthStore();
  const router = useRouter();

  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [verifyingSession, setVerifyingSession] = useState(false);
  // Set when we arrive holding credentials the server has already rejected.
  // almost always because the account was signed in somewhere else (sessions
  // are single-device). Without this the ejection is silent and reads as a bug.
  const [sessionEndedNotice, setSessionEndedNotice] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email">("email");

  // Fetch auth config and tenant info on mount
  useEffect(() => {
    if (isEditMode) {
      setConfigLoading(false);
      return;
    }

    Promise.all([
      userAuthApi
        .getConfig()
        .catch(() => ({
          emailPasswordEnabled: true,
          googleOauthEnabled: false,
          googleClientId: null,
          emailOtpEnabled: false,
          phoneOtpEnabled: false,
          signupEnabled: true,
          autoSignupOnLogin: false,
          phoneNumberRequired: false,
        } as AuthConfig)),
      userAuthApi
        .getTenantInfo()
        .catch(() => null),
    ]).then(([cfg, tenant]) => {
      setAuthConfig(cfg);
      if (tenant) setTenantInfo(tenant);
      setConfigLoading(false);
    });
  }, [isEditMode]);

  // Redirect authenticated users away from login page
  useEffect(() => {
    if (isEditMode) return;

    const verifyAndRedirect = async () => {
      // Wait for Zustand persist hydration
      if (!useUserAuthStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = useUserAuthStore.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
        });
      }

      const { isAuthenticated } = useUserAuthStore.getState();
      if (!isAuthenticated) return;

      setVerifyingSession(true);
      try {
        await userAuthApi.getMe();
        // Token valid, redirect to home or redirect param.
        // router.replace, not window.location.href: a full reload re-hydrates
        // this store from localStorage, and if the persist write from a
        // concurrent logout has not landed yet the app comes back up believing
        // it is signed in, bounces to the page, 401s, and returns here, the
        // login/logout loop. A client navigation keeps the in-memory state.
        const params = new URLSearchParams(window.location.search);
        router.replace(safeRedirectPath(params.get("redirect")));
      } catch {
        // Token invalid, the axios interceptor has already cleared auth state.
        // Say why, otherwise being silently ejected looks like a broken app.
        setSessionEndedNotice(true);
        setVerifyingSession(false);
      }
    };

    verifyAndRedirect();
  }, [isEditMode, router]);

  const handleContentUpdate = (key: keyof LoginFormContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const clearError = useCallback(() => setError(null), []);

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      storeLogin(data.member, data.accessToken);
      // Redirect to home or previous page
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        window.location.href = safeRedirectPath(params.get("redirect"));
      }
    },
    [storeLogin]
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode || !email || !password) return;

    setIsLoading(true);
    clearError();
    try {
      const result = await userAuthApi.login({ email, password });
      trackUserLogin("email");
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode || !email || !password || !name) return;

    setIsLoading(true);
    clearError();
    try {
      const result = await userAuthApi.signup({ email, password, name });
      trackUserSignup("email");
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (accessToken: string) => {
    setIsLoading(true);
    clearError();
    try {
      const result = await userAuthApi.googleAuth({ googleAccessToken: accessToken });
      trackUserLogin("google");
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (identifier: string, channel: "email") => {
    setIsLoading(true);
    clearError();
    try {
      await userAuthApi.sendOtp({ identifier, channel });
      setOtpIdentifier(identifier);
      setOtpChannel(channel);
      setAuthView("otp-verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsLoading(true);
    clearError();
    try {
      const result = await userAuthApi.verifyOtp({
        identifier: otpIdentifier,
        channel: otpChannel,
        code,
        name: name || undefined,
      });
      trackUserLogin(`otp_${otpChannel}`);
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const googleClientId = authConfig?.googleClientId || "";
  const isSignup = authView === "signup";
  const showSignupLink = authConfig?.signupEnabled && !authConfig?.autoSignupOnLogin;

  /* ---------- Shared: tenant logo + copyright helpers ---------- */
  const TenantLogo = !hideLogo && tenantInfo?.logoUrl ? (
    <div className="mb-7 flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tenantInfo.logoUrl}
        alt={tenantInfo.name}
        className="max-h-14 max-w-[200px] object-contain"
      />
    </div>
  ) : null;

  const CopyrightLine = !hideLogo && tenantInfo ? (
    <p className="mt-10 text-center text-xs tracking-wide text-muted-foreground">
      &copy; {new Date().getFullYear()} {tenantInfo.name}. All Rights Reserved.
    </p>
  ) : null;

  /* ---------- OTP verify view ---------- */
  if (authView === "otp-verify") {
    const handleResendOtp = async () => {
      await handleSendOtp(otpIdentifier, otpChannel);
    };

    return (
      <div
        className={cn(
          "mx-auto w-full max-w-md",
          showCard && CARD_CLASSES
        )}
      >
        {TenantLogo}
        <OtpForm
          identifier={otpIdentifier}
          channel={otpChannel}
          onVerify={handleVerifyOtp}
          onBack={() => setAuthView("login")}
          onResend={handleResendOtp}
          isLoading={isLoading}
          error={error}
        />
        {CopyrightLine}
      </div>
    );
  }

  /* ---------- Email OTP send view ---------- */
  if (authView === "email-otp-send") {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-md",
          showCard && CARD_CLASSES
        )}
      >
        {TenantLogo}
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">Email Verification</h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
            Enter your email to receive a verification code
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) handleSendOtp(email, "email");
          }}
          className="mt-7 space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="otp-email" className="text-[13px] font-medium text-foreground/80">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="otp-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                className={cn("h-11 rounded-xl pl-10 transition-colors duration-200", INPUT_FOCUS)}
                required
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button type="submit" className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-sm shadow-primary/20 transition-all duration-200" disabled={isLoading || !email}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Code
          </Button>
          <button
            type="button"
            onClick={() => { setAuthView("login"); clearError(); }}
            className="block w-full text-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Back to login
          </button>
        </form>
        {CopyrightLine}
      </div>
    );
  }

  /* ---------- Main login / signup view ---------- */
  const showEmailPassword = isEditMode || authConfig?.emailPasswordEnabled;
  const showGoogle = isEditMode || authConfig?.googleOauthEnabled;
  const showEmailOtp = isEditMode || authConfig?.emailOtpEnabled;
  const hasAnyOtpOrSocial = showGoogle || showEmailOtp;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md",
        showCard && CARD_CLASSES
      )}
    >
      {/* Tenant logo */}
      {!hideLogo && !isEditMode && tenantInfo?.logoUrl && (
        <div className="mb-7 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenantInfo.logoUrl}
            alt={tenantInfo.name}
            className="max-h-14 max-w-[200px] object-contain"
          />
        </div>
      )}

      {/* Headline */}
      <div className="text-center">
        {isEditMode ? (
          <>
            <EditableText
              value={content?.headline ?? "Login"}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="h2"
              className="text-2xl font-bold tracking-tight sm:text-[28px]"
            />
            {content?.subheadline && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                <EditableText
                  value={content.subheadline}
                  onChange={(v) => handleContentUpdate("subheadline", v)}
                />
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">
              {isSignup ? "Create Account" : (content?.headline ?? "Login")}
            </h2>
            {!isSignup && content?.subheadline && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                {content.subheadline}
              </p>
            )}
            {isSignup && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Fill in your details to get started
              </p>
            )}
          </>
        )}
      </div>

      {(configLoading || verifyingSession) && !isEditMode ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Signed out elsewhere, informational, not an error the user caused */}
          {sessionEndedNotice && !error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                You were signed out because this account was used on another device.
                Please sign in again.
              </span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email/Password Form */}
          {showEmailPassword && (
            <form
              onSubmit={isSignup ? handleSignupSubmit : handleLoginSubmit}
              className="mt-7 space-y-5"
            >
              {/* Name (signup only) */}
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="login-name" className="text-[13px] font-medium text-foreground/80">
                    Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                      id="login-name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); clearError(); }}
                      className={cn("h-11 rounded-xl pl-10 transition-colors duration-200", INPUT_FOCUS)}
                      disabled={isEditMode}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[13px] font-medium text-foreground/80">
                  {content?.emailLabel ?? "Email"}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={content?.emailPlaceholder ?? "Enter your email"}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    className={cn("h-11 rounded-xl pl-10 transition-colors duration-200", INPUT_FOCUS)}
                    disabled={isEditMode}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[13px] font-medium text-foreground/80">
                    {content?.passwordLabel ?? "Password"}
                  </Label>
                  {!isSignup && authConfig?.emailPasswordEnabled && (
                    <a
                      href={content?.forgotPasswordHref ?? "/forgot-password"}
                      className="text-[13px] font-medium text-primary transition-colors duration-200 hover:underline"
                    >
                      {content?.forgotPasswordText ?? "Forgot Password?"}
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={content?.passwordPlaceholder ?? "Enter your password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    className={cn("h-11 rounded-xl pl-10 pr-10 transition-colors duration-200", INPUT_FOCUS)}
                    disabled={isEditMode}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-150 hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-sm shadow-primary/20 transition-all duration-200" size="lg" disabled={isEditMode || isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignup ? "Create Account" : (content?.submitText ?? "Sign In")}
              </Button>
            </form>
          )}

          {/* Divider, show if email/password + any other method */}
          {showEmailPassword && hasAnyOtpOrSocial && (
            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-widest">
                <span className="bg-card px-4 text-muted-foreground/70">
                  {content?.socialHeadline ?? "Or continue with"}
                </span>
              </div>
            </div>
          )}

          {/* Alternative Auth Methods */}
          <div className={cn("space-y-3", !showEmailPassword && "mt-7")}>
            {/* Google OAuth */}
            {showGoogle && googleClientId && (
              <GoogleOAuthProvider clientId={googleClientId}>
                <GoogleLoginButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in was cancelled")}
                  disabled={isEditMode}
                />
              </GoogleOAuthProvider>
            )}

            {/* Email OTP */}
            {showEmailOtp && (
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
                onClick={() => { setAuthView("email-otp-send"); clearError(); }}
                disabled={isEditMode}
                type="button"
              >
                <Mail className="mr-2 h-4 w-4" />
                Sign in with Email OTP
              </button>
            )}

          </div>

          {/* Footer, signup/login toggle */}
          {!isEditMode && showSignupLink && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthView("login"); clearError(); }}
                    className="font-medium text-primary transition-colors duration-200 hover:underline"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setAuthView("signup"); clearError(); }}
                    className="font-medium text-primary transition-colors duration-200 hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </p>
          )}

          {/* Editable footer for edit mode */}
          {isEditMode && content?.footerText && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {content.footerText}{" "}
              {content?.footerLinkText && (
                <a
                  href={content?.footerLinkHref ?? "/contact"}
                  className="font-medium text-primary transition-colors duration-200 hover:underline"
                >
                  {content.footerLinkText}
                </a>
              )}
            </p>
          )}

          {/* Copyright line */}
          {!hideLogo && !isEditMode && tenantInfo && (
            <p className="mt-10 text-center text-xs tracking-wide text-muted-foreground">
              &copy; {new Date().getFullYear()} {tenantInfo.name}. All Rights Reserved.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */
export function LoginFormSection({ section }: LoginFormSectionProps) {
  const content = section.content as LoginFormContent;
  const isEditMode = useEditMode();
  const variant = section.variant;
  const hasCustomBg = hasCustomSectionBackground(section);
  const isMinimal = variant === "minimal";

  // Minimal: keep as simple centered form
  if (isMinimal) {
    return (
      <section
        className={cn(
          "flex min-h-screen items-center justify-center px-4 py-16",
          hasCustomBg ? "bg-transparent" : "bg-background"
        )}
      >
        <LoginCard
          content={content}
          section={section}
          isEditMode={isEditMode}
          showCard={false}
        />
      </section>
    );
  }

  // Default + Split: premium split-panel layout with animated brand panel.
  // Rendered in edit mode too so the left-panel text (tagline + features) can be
  // edited inline; the right-side form keeps its existing editable fields.
  return (
    <section className={cn("min-h-screen", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <SplitLoginLayout content={content} section={section} isEditMode={isEditMode} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Split layout with brand panel (runtime only, not edit mode)         */
/* ------------------------------------------------------------------ */
function SplitLoginLayout({
  content,
  section,
  isEditMode = false,
}: {
  content: LoginFormContent;
  section: SectionConfig;
  isEditMode?: boolean;
}) {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const { updateSectionContent } = useEditorStore();

  useEffect(() => {
    if (isEditMode) return; // builder: no live tenant fetch
    userAuthApi.getTenantInfo().then(setTenantInfo).catch(() => {});
  }, [isEditMode]);

  const updateFeature = (index: number, value: string) => {
    const base = normalizeLoginBrandFeatures(content?.brandFeatures);
    const next = base.map((f, i) =>
      i === index ? { ...f, text: value } : f
    );
    updateSectionContent(section.id, { brandFeatures: next });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* ── Brand Panel (desktop), left text is editable in the builder ── */}
      <AuthBrandPanel
        tenantInfo={tenantInfo}
        tagline={content?.brandTagline}
        features={content?.brandFeatures}
        isEditMode={isEditMode}
        onTaglineChange={
          isEditMode
            ? (v) => updateSectionContent(section.id, { brandTagline: v })
            : undefined
        }
        onFeatureChange={isEditMode ? updateFeature : undefined}
      />

      {/* ── Form Panel ── */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 lg:min-h-0 lg:px-16">
        {/* Mobile-only tenant logo */}
        {tenantInfo?.logoUrl && (
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md shadow-black/5 dark:bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tenantInfo.logoUrl}
                alt={tenantInfo.name}
                className="h-14 w-14 object-contain"
              />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {tenantInfo.name}
            </h1>
          </div>
        )}

        <LoginCard
          content={content}
          section={section}
          isEditMode={false}
          showCard={false}
          hideLogo
        />

        {/* Mobile-only footer */}
        {tenantInfo && (
          <footer className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
            &copy; {new Date().getFullYear()} {tenantInfo.name}. All rights reserved.
          </footer>
        )}
      </div>
    </div>
  );
}

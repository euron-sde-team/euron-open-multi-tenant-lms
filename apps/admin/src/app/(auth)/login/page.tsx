"use client";

import { Button, Input, Label } from "@open-mtlms/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { getToken } from "@/lib/api/axios";
import { useLogin, useMe } from "@/lib/hooks/use-auth";
import { appendUtmToUrl } from "@/lib/utils/utm";

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? null;

  const loginMutation = useLogin();

  const isPending = loginMutation.isPending;
  const displayError = loginMutation.error ? loginMutation.error.message : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="w-full max-w-[400px]">
      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin Login
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {callbackUrl
            ? "Please sign in to continue"
            : "Enter your credentials to access the dashboard"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {/* Error */}
        {displayError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive dark:bg-destructive/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-foreground/80">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
              className="h-11 rounded-xl pl-10 transition-colors duration-200"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[13px] font-medium text-foreground/80">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
              className="h-11 rounded-xl pl-10 pr-10 transition-colors duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-150 hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="h-11 w-full text-[15px] font-medium"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      {/* Footer links */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/start"
          className="text-[13px] text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          New here? Create an account
        </Link>
        <Link
          href="/forgot-password"
          className="text-[13px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}

function AuthFormFallback() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="space-y-1.5">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-7 space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" style={{ animationDelay: "75ms" }} />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted" style={{ animationDelay: "150ms" }} />
        </div>
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" style={{ animationDelay: "225ms" }} />
      </div>
    </div>
  );
}

/**
 * Guards the login page, if the user already has a valid token,
 * redirects to /dashboard instead of showing the login form.
 */
function LoginPageGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Start with spinner to avoid server/client hydration mismatch
  // (localStorage is not available on the server)
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error } = useMe();

  useEffect(() => {
    const token = getToken();

    // No token, show the login form immediately
    if (!token) {
      setShowForm(true);
      return;
    }

    // Token exists, wait for useMe() to resolve
    if (isLoading) return;

    if (data && !error) {
      // Valid session, redirect to dashboard (or callback URL), preserve UTM
      const callbackUrl = searchParams?.get("callbackUrl");
      const redirectTo = callbackUrl ? decodeURIComponent(callbackUrl) : "/dashboard";
      router.replace(appendUtmToUrl(redirectTo));
    } else {
      // Token is invalid/expired: Axios interceptor already cleared session state on 401
      setShowForm(true);
    }
  }, [isLoading, data, error, router, searchParams]);

  if (!showForm) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageLayout>
          <AuthFormFallback />
        </AuthPageLayout>
      }
    >
      <LoginPageGuard>
        <AuthPageLayout>
          <AuthForm />
        </AuthPageLayout>
      </LoginPageGuard>
    </Suspense>
  );
}

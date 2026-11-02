"use client";

import {
  Button,
  Input,
  Label,
} from "@open-mtlms/core";
import Link from "next/link";
import { Suspense, useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";

import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { PhoneInput } from "@/components/auth/phone-input";
import { useSignup } from "@/lib/hooks/use-auth";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New users land on the quiz wizard, not the dashboard. The dashboard
  // assumes a tenant exists; the wizard is the path that creates one.
  const signupMutation = useSignup({ redirectTo: "/onboarding/quiz" });

  const isPending = signupMutation.isPending;
  const displayError =
    formError ?? (signupMutation.error ? signupMutation.error.message : null);
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!phone) {
      setFormError("Phone number is required");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match");
      return;
    }

    signupMutation.mutate({ name: name.trim(), email, password, phone });
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Build your academy in 60 seconds. Tell us a bit about yourself and
          we'll handle the rest.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {displayError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive dark:bg-destructive/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-[13px] font-medium text-foreground/80"
          >
            Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isPending}
              className="h-11 rounded-xl pl-10 transition-colors duration-200"
              autoComplete="name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[13px] font-medium text-foreground/80"
          >
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
              className="h-11 rounded-xl pl-10 transition-colors duration-200"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="phone"
            className="text-[13px] font-medium text-foreground/80"
          >
            Phone Number
          </Label>
          <PhoneInput
            value={phone}
            onChange={(value) => {
              setPhone(value ?? "");
              setFormError(null);
            }}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-[13px] font-medium text-foreground/80"
          >
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isPending}
              className="h-11 rounded-xl px-10 transition-colors duration-200"
              autoComplete="new-password"
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

        <div className="space-y-2">
          <Label
            htmlFor="confirm-password"
            className="text-[13px] font-medium text-foreground/80"
          >
            Confirm password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isPending}
              aria-invalid={passwordsMismatch || undefined}
              className="h-11 rounded-xl px-10 transition-colors duration-200"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-150 hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {passwordsMismatch && (
            <p className="text-[12px] text-destructive">
              Passwords don't match
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-[15px] font-medium shadow-sm shadow-primary/25 transition-all duration-200"
          disabled={isPending || passwordsMismatch}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create my account →"
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-center">
        <Link
          href="/login"
          className="text-[13px] text-muted-foreground underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline"
        >
          Already have an account? Sign in
        </Link>
      </div>

    </div>
  );
}

function FormFallback() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="space-y-1.5">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-7 space-y-5">
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<FormFallback />}>
        <SignupForm />
      </Suspense>
    </AuthPageLayout>
  );
}

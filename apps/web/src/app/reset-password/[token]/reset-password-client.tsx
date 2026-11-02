"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@open-mtlms/core";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import type { ThemeConfig } from "@open-mtlms/shared";
import { userAuthApi } from "@/lib/api/auth";

interface ResetPasswordClientProps {
  theme?: ThemeConfig;
  token: string;
}

export function ResetPasswordClient({ theme, token }: ResetPasswordClientProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await userAuthApi.resetPassword({ token, newPassword });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitLayout theme={theme}>
      <div className="w-full max-w-[440px] rounded-2xl border-0 bg-card/80 p-8 shadow-xl shadow-black/[0.04] backdrop-blur-sm dark:border dark:border-border/50 dark:shadow-black/20 sm:p-10">
        {success ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Password Reset!</h2>
            <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
              Your password has been updated. Redirecting you to login&hellip;
            </p>
            <Link href="/login" className="text-sm font-medium text-primary transition-colors duration-200 hover:underline">
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Set New Password</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Enter a new password for your account.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive dark:bg-destructive/10">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rp-password" className="text-[13px] font-medium text-foreground/80">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="rp-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    className="h-11 rounded-xl pl-10 pr-10 transition-colors duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
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
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rp-confirm" className="text-[13px] font-medium text-foreground/80">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="rp-confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    className="h-11 rounded-xl pl-10 pr-10 transition-colors duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-150 hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-[15px] font-medium shadow-sm shadow-primary/25 transition-all duration-200"
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}

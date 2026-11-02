"use client";

import { useState } from "react";
import { Button, Input, Label } from "@open-mtlms/core";
import { Loader2, Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import type { ThemeConfig } from "@open-mtlms/shared";
import { userAuthApi } from "@/lib/api/auth";

interface ForgotPasswordClientProps {
  theme?: ThemeConfig;
}

export function ForgotPasswordClient({ theme }: ForgotPasswordClientProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError("");

    try {
      await userAuthApi.forgotPassword({ email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthSplitLayout theme={theme}>
      <div className="w-full max-w-[440px] rounded-2xl border-0 bg-card/80 p-8 shadow-xl shadow-black/[0.04] backdrop-blur-sm dark:border dark:border-border/50 dark:shadow-black/20 sm:p-10">
        {submitted ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Check your email</h2>
            <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
              If an account with <strong className="text-foreground">{email}</strong> exists, we&apos;ve sent a password reset link.
              Check your inbox and spam folder.
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-primary transition-colors duration-200 hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Forgot Password?</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
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
                <Label htmlFor="fp-email" className="text-[13px] font-medium text-foreground/80">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="h-11 rounded-xl pl-10 transition-colors duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-[15px] font-medium shadow-sm shadow-primary/25 transition-all duration-200"
                disabled={isLoading || !email}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}

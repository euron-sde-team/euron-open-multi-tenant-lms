"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@open-mtlms/core";
import { Loader2, Zap } from "lucide-react";
import { getErrorMessage } from "@open-mtlms/shared";
import { OtpForm } from "./otp-form";
import { PhoneInput } from "./phone-input";
import { userAuthApi } from "@/lib/api/auth";
import { useUserAuthStore } from "@/lib/stores/auth-store";

interface EasyCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Phase =
  | { kind: "collect" }
  | { kind: "otp"; identifier: string; channel: "email" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EasyCheckoutModal({ open, onOpenChange, onSuccess }: EasyCheckoutModalProps) {
  const login = useUserAuthStore((s) => s.login);
  const storeLogout = useUserAuthStore((s) => s.logout);

  const [phase, setPhase] = useState<Phase>({ kind: "collect" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase({ kind: "collect" });
    setName("");
    setEmail("");
    setPhone("");
    setError(null);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const validate = (): string | null => {
    if (!name.trim()) {
      return "Enter your name";
    }
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      return "Enter a valid email address";
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      return "Enter a valid phone number";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await userAuthApi.easyCheckoutSignup({
        email: email.trim(),
        phone,
        name: name.trim(),
      });
      if (res.ok) {
        login(res.result.member, res.result.accessToken);
        // Order matters: onSuccess() runs the queued Buy Now action via the guard's
        // pendingAction. If onOpenChange(false) fires first (which triggers
        // guard.onClose → setPendingAction(null)), the subsequent onSuccess() sees a
        // null pendingAction and the action never runs, leaving the user stranded
        // on the product page after a successful signup. Run onSuccess first so the
        // queued action's window.location.href / router.push fires while pendingAction
        // is still valid.
        onSuccess();
        onOpenChange(false);
        reset();
      } else {
        setPhase({ kind: "otp", identifier: res.matchedIdentifier, channel: res.channel });
      }
    } catch (e) {
      setError(getErrorMessage(e) || "Could not continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (phase.kind !== "otp") return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await userAuthApi.verifyOtp({
        identifier: phase.identifier,
        channel: phase.channel,
        code,
      });
      login(result.member, result.accessToken);
      // Same ordering rule as handleSubmit: onSuccess (which runs the queued
      // pendingAction via the guard) must fire BEFORE onOpenChange clears the
      // pendingAction via guard.onClose. Otherwise the queued Buy Now action is
      // discarded and the user lands on the product page authenticated but with
      // no checkout in progress.
      onSuccess();
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(getErrorMessage(e) || "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (phase.kind !== "otp") return;
    await userAuthApi.sendOtp({ identifier: phase.identifier, channel: phase.channel });
  };

  const handleLogout = () => {
    storeLogout();
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {phase.kind === "collect" ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                <Zap className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">Quick checkout</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="ec-name">Name</Label>
                <Input
                  id="ec-name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec-email">Email</Label>
                <Input
                  id="ec-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec-phone">Phone</Label>
                <PhoneInput
                  value={phone}
                  onChange={(v) => setPhone(v ?? "")}
                  disabled={submitting}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="button"
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to checkout
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By continuing you agree to our terms. We will only use these details
                to deliver your purchase.
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">Account already exists</DialogTitle>
              <DialogDescription className="text-center">
                We found an account with these details. Verify it is you to continue.
              </DialogDescription>
            </DialogHeader>

            <OtpForm
              identifier={phase.identifier}
              channel={phase.channel}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => {
                setPhase({ kind: "collect" });
                setEmail("");
                setPhone("");
                setError(null);
              }}
              isLoading={submitting}
              error={error}
            />

            <div className="border-t pt-4 text-center">
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Logout
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
} from "@open-mtlms/core";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "@open-mtlms/shared";
import { OtpForm } from "./otp-form";
import { userAuthApi } from "@/lib/api/auth";
import { useUserAuthStore } from "@/lib/stores/auth-store";

function extractApiError(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err);
  return msg === "An error occurred" ? fallback : msg;
}

/** Placeholder emails minted for phone first signups look like `<digits>@phone.user`. */
function isPhoneDerivedEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@phone.user");
}

interface NameConfirmationModalProps {
  open: boolean;
}

type Step = "form" | "otp";

export function NameConfirmationModal({ open }: NameConfirmationModalProps) {
  const member = useUserAuthStore((s) => s.member);
  const setMember = useUserAuthStore((s) => s.setMember);

  const canEditEmail = isPhoneDerivedEmail(member?.email);

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Prefill the current name whenever the modal opens for a member so "keep my
  // name" is a single click. Reset the transient email/step/error each time.
  useEffect(() => {
    if (open && member) {
      setName(member.name ?? "");
      setEmail("");
      setStep("form");
      setError("");
    }
  }, [open, member?.id]);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const wantsEmailChange = canEditEmail && trimmedEmail.length > 0;

  const finalizeConfirm = async (code?: string) => {
    setIsLoading(true);
    setError("");
    try {
      const updated = await userAuthApi.confirmName({
        name: trimmedName,
        ...(wantsEmailChange ? { email: trimmedEmail, code } : {}),
      });
      setMember(updated);
    } catch (err) {
      setError(extractApiError(err, "Could not save. Please try again."));
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    // No email change: confirm the name in a single step.
    if (!wantsEmailChange) {
      await finalizeConfirm();
      return;
    }

    // Email change: send a verification code to the new address first.
    setIsLoading(true);
    setError("");
    try {
      await userAuthApi.sendConfirmNameEmailOtp(trimmedEmail);
      setStep("otp");
    } catch (err) {
      setError(extractApiError(err, "Could not send the code. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    await userAuthApi.sendConfirmNameEmailOtp(trimmedEmail);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Confirm your name</DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Please confirm how your name should appear. You can update it, or keep it and continue."
              : `Enter the code sent to ${trimmedEmail}.`}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-name">Full name</Label>
                <Input
                  id="confirm-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="Your name"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              {canEditEmail && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-email">Email (optional)</Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your account was created with a phone number. Add a real email
                    to receive updates. We will send a code to verify it.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || !trimmedName}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {wantsEmailChange ? "Send code and continue" : "Confirm"}
              </Button>
            </form>
          </>
        ) : (
          <OtpForm
            identifier={trimmedEmail}
            channel="email"
            onVerify={(code) => finalizeConfirm(code)}
            onBack={() => {
              setStep("form");
              setError("");
            }}
            onResend={handleResendOtp}
            isLoading={isLoading}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

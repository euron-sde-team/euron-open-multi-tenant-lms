"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@open-mtlms/core";
import { OtpForm } from "./otp-form";
import { userAuthApi } from "@/lib/api/auth";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { getErrorMessage } from "@open-mtlms/shared";

function extractApiError(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err);
  return msg === "An error occurred" ? fallback : msg;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 3))}${local[local.length - 1]}@${domain}`;
}

interface EmailVerificationModalProps {
  open: boolean;
}

export function EmailVerificationModal({ open }: EmailVerificationModalProps) {
  const router = useRouter();
  const member = useUserAuthStore((s) => s.member);
  const setMember = useUserAuthStore((s) => s.setMember);
  const storeLogout = useUserAuthStore((s) => s.logout);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const email = member?.email ?? "";

  const handleLogout = () => {
    // Escape hatch for users who logged in / signed up with the wrong email.
    // Clears Zustand + localStorage auth, then routes to /login so they can
    // start over with a different account.
    storeLogout();
    router.push("/login");
  };

  useEffect(() => {
    if (!open || otpSent) return;

    userAuthApi
      .sendVerifyEmailOtp()
      .then(() => setOtpSent(true))
      .catch((err) => {
        setError(extractApiError(err, "Failed to send verification email"));
      });
  }, [open, otpSent]);

  const handleVerify = async (code: string) => {
    setIsLoading(true);
    setError("");
    try {
      const updatedMember = await userAuthApi.verifyEmail({ code });
      setMember(updatedMember);
    } catch (err) {
      setError(extractApiError(err, "Invalid OTP. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    await userAuthApi.sendVerifyEmailOtp();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Email Verification Required</DialogTitle>
          <DialogDescription>
            Please verify your email address to continue. A verification code has been sent to{" "}
            <span className="font-medium">{maskEmail(email)}</span>.
          </DialogDescription>
        </DialogHeader>

        <OtpForm
          identifier={maskEmail(email)}
          channel="email"
          onVerify={handleVerify}
          onResend={handleResend}
          isLoading={isLoading}
          error={error}
        />

        <div className="border-t pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Wrong account?{" "}
            <button
              type="button"
              onClick={handleLogout}
              className="font-medium text-primary transition-colors hover:underline"
            >
              Logout
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Input } from "@open-mtlms/core";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface OtpFormProps {
  identifier: string;
  channel: "email";
  onVerify: (code: string) => void;
  onBack?: () => void;
  onResend?: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

const RESEND_COOLDOWN = 60;

export function OtpForm({
  identifier,
  channel,
  onVerify,
  onBack,
  onResend,
  isLoading,
  error,
}: OtpFormProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (onResend) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    if (!onResend || isResending) return;
    setIsResending(true);
    try {
      await onResend();
      startTimer();
    } finally {
      setIsResending(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];

    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setDigits(newDigits);
      const nextEmpty = newDigits.findIndex((d) => !d);
      const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
      inputsRef.current[focusIndex]?.focus();
      if (newDigits.every((d) => d)) {
        onVerify(newDigits.join(""));
      }
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newDigits.every((d) => d)) {
      onVerify(newDigits.join(""));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const channelLabel =
    channel === "email" ? "email" : "WhatsApp";

  return (
    <div className="space-y-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="text-center">
        <h3 className="text-xl font-bold tracking-tight">Verify your {channelLabel}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">{identifier}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2.5 sm:gap-3">
        {digits.map((digit, i) => (
          <Input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-14 w-12 rounded-xl border-2 border-border/60 bg-background text-center text-xl font-bold transition-all duration-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:shadow-sm sm:w-14"
            disabled={isLoading}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {onResend && (
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          {countdown > 0 ? (
            <span className="font-mono tabular-nums">Resend in {countdown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-medium text-primary transition-colors duration-200 hover:underline disabled:opacity-50"
            >
              {isResending ? "Sending..." : "Resend"}
            </button>
          )}
        </p>
      )}

      {onBack && (
        <div className="border-t pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Not your account?{" "}
            <button
              type="button"
              onClick={onBack}
              className="font-medium text-primary transition-colors duration-200 hover:underline"
            >
              Use a different email
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

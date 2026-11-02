"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";

interface AccessDeniedProps {
  title: string;
  type: "course" | "book";
  redirectUrl: string;
}

const COUNTDOWN_SECONDS = 5;

export function AccessDenied({ title, type, redirectUrl }: AccessDeniedProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const handleRedirect = useCallback(() => {
    router.replace(redirectUrl);
  }, [router, redirectUrl]);

  useEffect(() => {
    if (countdown <= 0) {
      handleRedirect();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, handleRedirect]);

  const label = type === "course" ? "Course" : "Book";

  return (
    <div className="bg-background flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4">
      <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
        <Lock className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">Access Required</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          You need to enroll in{" "}
          <span className="text-foreground font-medium">{title}</span> to access
          this {type}. Visit the {type} page to get started.
        </p>
      </div>

      <button
        onClick={handleRedirect}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
      >
        View {label}
        <ArrowRight className="h-4 w-4" />
      </button>

      <p className="text-muted-foreground text-xs">
        Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}…
      </p>
    </div>
  );
}

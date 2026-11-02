"use client";

import { Button } from "@open-mtlms/core";
import type { LayoutTopBar, TopBarContent } from "@open-mtlms/shared";
import { X } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface TopBarProps {
  config: LayoutTopBar;
  className?: string;
}

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(targetDate: string | undefined): CountdownTime | null {
  const [timeLeft, setTimeLeft] = useState<CountdownTime | null>(null);

  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference <= 0) {
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      if (newTimeLeft === null) {
        clearInterval(timer);
      }
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function CountdownDisplay({ targetDate, label }: { targetDate: string; label?: string }) {
  const timeLeft = useCountdown(targetDate);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-center gap-1 font-mono text-sm">
        <span className="rounded bg-black/20 px-1.5 py-0.5">
          {String(timeLeft.days).padStart(2, "0")}d
        </span>
        <span>:</span>
        <span className="rounded bg-black/20 px-1.5 py-0.5">
          {String(timeLeft.hours).padStart(2, "0")}h
        </span>
        <span>:</span>
        <span className="rounded bg-black/20 px-1.5 py-0.5">
          {String(timeLeft.minutes).padStart(2, "0")}m
        </span>
        <span>:</span>
        <span className="rounded bg-black/20 px-1.5 py-0.5">
          {String(timeLeft.seconds).padStart(2, "0")}s
        </span>
      </div>
    </div>
  );
}

function TextContent({ content }: { content: TopBarContent }) {
  return (
    <div className="flex items-center gap-2">
      {content.text && <span>{content.text}</span>}
      {content.link && (
        <Link
          href={content.link.href}
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          {content.link.text}
        </Link>
      )}
    </div>
  );
}

function RichContent({ content }: { content: TopBarContent }) {
  if (!content.richContent) return null;

  const { message, buttons, countdown } = content.richContent;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {message && <span className="text-center">{message}</span>}

      {countdown?.enabled && countdown.targetDate && (
        <CountdownDisplay targetDate={countdown.targetDate} label={countdown.label} />
      )}

      {buttons && buttons.length > 0 && (
        <div className="flex items-center gap-2">
          {buttons.map((button, index) => (
            <Button
              key={index}
              variant={button.variant === "primary" ? "default" : button.variant}
              size="sm"
              asChild
            >
              <Link href={button.href}>{button.text}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({ config, className }: TopBarProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!config.enabled || isDismissed) return null;

  const backgroundColor = config.backgroundColor
    ? `hsl(${config.backgroundColor})`
    : "hsl(var(--primary))";
  const textColor = config.textColor
    ? `hsl(${config.textColor})`
    : "hsl(var(--primary-foreground))";

  return (
    <div
      className={cn(
        "relative flex min-h-[40px] items-center justify-center px-4 py-2 text-sm",
        className
      )}
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {config.content.type === "text" ? (
        <TextContent content={config.content} />
      ) : (
        <RichContent content={config.content} />
      )}

      {config.dismissible && (
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/10"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

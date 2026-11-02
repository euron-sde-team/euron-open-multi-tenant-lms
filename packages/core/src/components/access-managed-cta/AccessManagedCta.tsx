"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export interface AccessManagedCtaProps {
  /** Whether the viewer already owns this item. */
  hasAccess: boolean;
  /** Where "Access Now" points (learn/read/watch URL). Required when hasAccess. */
  accessHref?: string | null;
  /** Tenant support email for the "Contact Support" mailto. */
  supportEmail?: string | null;
  /** Optional mailto subject (e.g. the item title) to give support context. */
  contactSubject?: string | null;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  /** Stretch to fill the parent (matches most buy-button slots). */
  fullWidth?: boolean;
  className?: string;
  /** "Access Now" label override (e.g. "Start Learning", "Read Now"). */
  accessLabel?: string;
}

/**
 * The single CTA for access-managed storefronts (tenant hides pricing and
 * disables self-serve purchase): owners keep their usual "Access Now" entry
 * point; everyone else gets "Contact Support" (mailto the tenant's support
 * email) instead of a price or buy button. With no support email configured
 * we render a disabled hint rather than a dead link.
 */
export function AccessManagedCta({
  hasAccess,
  accessHref,
  supportEmail,
  contactSubject,
  size = "default",
  variant = "default",
  fullWidth = false,
  className,
  accessLabel = "Access Now",
}: AccessManagedCtaProps) {
  const widthClass = fullWidth ? "w-full" : undefined;

  if (hasAccess && accessHref) {
    return (
      <Button asChild size={size} variant={variant} className={cn(widthClass, className)}>
        <a href={accessHref}>{accessLabel}</a>
      </Button>
    );
  }

  if (supportEmail) {
    const mailto = contactSubject
      ? `mailto:${supportEmail}?subject=${encodeURIComponent(`Access request: ${contactSubject}`)}`
      : `mailto:${supportEmail}`;
    return (
      <Button asChild size={size} variant={variant} className={cn(widthClass, className)}>
        <a href={mailto}>Contact Support</a>
      </Button>
    );
  }

  return (
    <Button size={size} variant="secondary" disabled className={cn(widthClass, className)}>
      Contact your administrator
    </Button>
  );
}

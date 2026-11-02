"use client";

/**
 * SafeLink
 *
 * Smart link component that handles external, anchor, and internal links.
 * - External links (http/https/mailto/tel): render <a target="_blank">
 * - Anchor links (#...): render <a>
 * - Internal links: render Next.js <Link> (standard routing, 404 handles bad paths)
 */

import Link from "next/link";
import * as React from "react";

function isExternalHref(href: string): boolean {
  const trimmed = href?.trim() ?? "";
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  );
}

function isAnchorHref(href: string): boolean {
  return (href?.trim() ?? "").startsWith("#");
}

export interface SafeLinkProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  href: string;
  children: React.ReactNode;
  /** Open external links in new tab (default: true) */
  openInNewTab?: boolean;
}

export function SafeLink({ href, children, openInNewTab = true, ...props }: SafeLinkProps) {
  // External links: use <a> with target
  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target={openInNewTab ? "_blank" : "_self"}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  // Anchor links: use standard anchor
  if (isAnchorHref(href)) {
    return (
      <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  // Internal links: use Next.js Link (standard routing)
  const normalizedPath = href.startsWith("/") ? href : `/${href}`;

  return (
    <Link href={normalizedPath} {...props}>
      {children}
    </Link>
  );
}

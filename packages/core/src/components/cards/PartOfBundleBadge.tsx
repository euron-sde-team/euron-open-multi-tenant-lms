"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "../../lib/utils";

export interface BundleRef {
  id: string;
  title: string;
  slug: string;
}

export interface PartOfBundleBadgeProps {
  bundles: BundleRef[] | undefined;
  /**
   * Where a bundle lives on this site. Defaults to the storefront route.
   * Pass a non-linking variant in admin previews.
   */
  hrefFor?: (bundle: BundleRef) => string;
  /** Render as plain text, used where an enclosing card is already a link. */
  asLink?: boolean;
  /**
   * Overlaid on a thumbnail rather than sitting on the card surface. A
   * primary tint disappears against an arbitrary photo, so this switches to
   * an opaque light pill with a blur behind it.
   */
  onImage?: boolean;
  className?: string;
}

/**
 * "Part of <Bundle>", tells a learner this course/book/test series is also
 * sold as part of a bundle, so they can find the better deal instead of
 * discovering it after buying.
 *
 * Names the bundle rather than saying "Part of a bundle": the whole point is
 * to let someone go look at it, and an unnamed bundle gives them nothing to
 * act on.
 *
 * When an item is in several bundles, EACH gets its own link. A single chip
 * reading "Part of X +1" tells the learner a second bundle exists and then
 * gives them no way to reach it, the count is precisely what makes them want
 * it. Admin cards keep the compact "+N" form, since nothing there is clickable
 * anyway and card space is tighter.
 *
 * Matches the existing pill on BundleCard (Layers glyph, translucent blur, no
 * border) so it reads as part of the same family rather than a new element.
 */
export function PartOfBundleBadge({
  bundles,
  hrefFor = (b) => `/bundles/${b.slug}`,
  asLink = true,
  onImage = false,
  className,
}: PartOfBundleBadgeProps) {
  if (!bundles || bundles.length === 0) return null;

  const [first, ...rest] = bundles;

  const chipClass = cn(
    // items-start + leading-tight so a wrapped second line sits under the
    // first rather than pushing the glyph off-centre. No truncate: on a narrow
    // card (book covers are 85% of an already-slim column) clipping hides the
    // bundle name, which is the only actionable thing on the chip.
    // A tinted fill in the tenant's own primary, not a translucent white:
    // bg-background/80 on a white card is nearly invisible and the chip reads
    // as loose text rather than something you can act on. primary/10 keeps it
    // quiet next to the title while still looking deliberate, and stays
    // on-brand because primary is tenant-controlled.
    //
    // items-start + leading-tight so a wrapped second line sits under the
    // first rather than pushing the glyph off-centre. No truncate: on a narrow
    // card (book covers are 85% of an already-slim column) clipping hides the
    // bundle name, which is the only actionable thing on the chip.
    "inline-flex max-w-full items-start gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight",
    onImage
      ? "bg-background/90 text-foreground shadow-sm backdrop-blur-sm"
      : "bg-primary/10 text-primary",
    asLink &&
      (onImage ? "hover:bg-background" : "hover:bg-primary/20") +
        " transition-colors",
    className
  );

  /** The named bundle, with the Layers glyph. */
  const mainChip = (
    <span className={chipClass}>
      <Layers className="mt-[1px] h-3 w-3 shrink-0" />
      <span className="min-w-0">Part of {first.title}</span>
    </span>
  );

  if (!asLink) {
    // Admin cards: one static chip, the extras summarised rather than linked.
    return rest.length > 0 ? (
      <span
        className={chipClass}
        title={`Also in: ${rest.map((b) => b.title).join(", ")}`}
      >
        <Layers className="mt-[1px] h-3 w-3 shrink-0" />
        <span className="min-w-0">
          Part of {first.title} +{rest.length}
        </span>
      </span>
    ) : (
      mainChip
    );
  }

  return (
    // Each bundle gets its OWN link. A single link carrying "+1" tells the
    // learner they're in two bundles and then only lets them reach one, the
    // count is the whole reason they'd want the other.
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <Link
        href={hrefFor(first)}
        // The card itself is usually a link to the course; without this the
        // click bubbles and the learner lands on the course, not the bundle.
        onClick={(e) => e.stopPropagation()}
        title={`View ${first.title}`}
        className="max-w-full"
      >
        {mainChip}
      </Link>
      {rest.map((b) => (
        <Link
          key={b.id}
          href={hrefFor(b)}
          onClick={(e) => e.stopPropagation()}
          title={`View ${b.title}`}
          className="max-w-full"
        >
          <span className={chipClass}>
            <span className="min-w-0">{b.title}</span>
          </span>
        </Link>
      ))}
    </span>
  );
}

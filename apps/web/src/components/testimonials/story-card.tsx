"use client";

import {
  SocialLinks,
  StarRating,
} from "@/components/testimonials/story-parts";
import type { TestimonialItem } from "@/lib/api/testimonials";
import { cn } from "@/lib/utils";
import { FileText, Quote } from "lucide-react";

/**
 * One success story.
 *
 * Every card is the same height so the wall reads as a grid rather than a
 * staircase: the proof panel is a fixed size, the quote is clamped, and the
 * author row is pinned to the bottom with mt-auto. The full letter and the
 * untruncated quote live in a dialog, so nothing is lost to the clamp.
 */
export function TestimonialCard({
  testimonial,
  onOpen,
}: {
  testimonial: TestimonialItem;
  onOpen: () => void;
}) {
  const displayName = testimonial.memberName || testimonial.name;
  const avatarUrl = testimonial.memberAvatar || testimonial.imageUrl;
  const initial = displayName?.charAt(0)?.toUpperCase() || "?";
  const hasImage = testimonial.imageUrl && !testimonial.memberAvatar;

  return (
    <article
      className={cn(
        "group bg-card text-card-foreground ring-border/70 flex h-full flex-col",
        "overflow-hidden rounded-2xl shadow-sm ring-1",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      )}
    >
      {/* Proof panel.
          The letter sits inset on a muted mat with its own ring, so a white
          document always has a visible edge no matter what the tenant has set
          --card and --background to. Fixed height keeps every card aligned. */}
      <div className="bg-muted border-border/70 relative h-52 shrink-0 border-b p-3 sm:h-56">
        {hasImage && testimonial.imageUrl ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`View ${displayName || "this"} offer letter`}
            className={cn(
              "ring-border/80 relative block h-full w-full overflow-hidden rounded-xl",
              "shadow-sm ring-1 transition-shadow hover:shadow-md",
              "focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2"
            )}
          >
            <img
              src={testimonial.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* A solid chip rather than text over a scrim: these documents are
                white with dark text in unpredictable places, so nothing layered
                directly on them stays readable. */}
            <span className="bg-background/95 text-foreground ring-border/70 pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ring-1 backdrop-blur-sm">
              <FileText className="h-3.5 w-3.5" />
              View offer letter
            </span>
          </button>
        ) : (
          // No letter attached: a quote panel of the same height, so a card
          // without proof still lines up with the ones that have it.
          <div className="bg-card ring-border/80 flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl px-6 ring-1">
            <Quote className="text-primary/25 h-10 w-10" />
            <span className="text-muted-foreground text-[11px] font-medium">
              In their words
            </span>
          </div>
        )}
      </div>

      {/* Story */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {testimonial.text && (
          <p className="text-foreground/85 line-clamp-4 text-[0.9rem] leading-relaxed">
            {testimonial.text}
          </p>
        )}

        {testimonial.rating != null && testimonial.rating > 0 && (
          <div className="mt-4">
            <StarRating value={testimonial.rating} />
          </div>
        )}

        {/* Pinned to the bottom so author rows align across the row */}
        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={onOpen}
            className="text-primary mb-4 text-sm font-medium hover:underline"
          >
            Read full story
          </button>
          <div className="bg-border/70 mb-4 h-px" />
          <div className="flex items-center gap-3">
            {avatarUrl && !hasImage ? (
              <img
                src={avatarUrl}
                alt={displayName || "User"}
                className="ring-background h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2"
              />
            ) : (
              <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-semibold">
                {displayName}
              </p>
            </div>
            <SocialLinks links={testimonial.socialLinks} />
          </div>
        </div>
      </div>
    </article>
  );
}

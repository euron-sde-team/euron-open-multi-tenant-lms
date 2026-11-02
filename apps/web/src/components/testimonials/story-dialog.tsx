"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SocialLinks,
  StarRating,
} from "@/components/testimonials/story-parts";
import type { TestimonialItem } from "@/lib/api/testimonials";
import { FileText } from "lucide-react";

/**
 * The whole story: the offer letter at full size and the quote untruncated.
 * The letter scrolls inside the dialog rather than being scaled down, since
 * these are dense documents and shrinking them makes them unreadable.
 */
export function StoryDialog({
  testimonial,
  open,
  onOpenChange,
}: {
  testimonial: TestimonialItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!testimonial) return null;
  const displayName = testimonial.memberName || testimonial.name;
  const avatarUrl = testimonial.memberAvatar || testimonial.imageUrl;
  const initial = displayName?.charAt(0)?.toUpperCase() || "?";
  const hasImage = testimonial.imageUrl && !testimonial.memberAvatar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border/70 shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-3 text-base">
            {avatarUrl && !hasImage ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
                {initial}
              </span>
            )}
            <span className="truncate">{displayName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {testimonial.rating != null && testimonial.rating > 0 && (
            <div className="mb-4">
              <StarRating value={testimonial.rating} size="md" />
            </div>
          )}
          {testimonial.text && (
            <p className="text-foreground/90 mb-6 text-[0.95rem] leading-relaxed">
              {testimonial.text}
            </p>
          )}
          {hasImage && testimonial.imageUrl && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-muted-foreground mb-2 flex items-center gap-1.5 px-1 text-xs font-medium">
                <FileText className="h-3.5 w-3.5" />
                Offer letter
              </p>
              <div className="ring-border/80 overflow-hidden rounded-lg shadow-sm ring-1">
                <img
                  src={testimonial.imageUrl}
                  alt={`${displayName || "Member"} offer letter`}
                  className="h-auto w-full"
                />
              </div>
            </div>
          )}
          <SocialLinks links={testimonial.socialLinks} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

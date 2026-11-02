"use client";

import { cn } from "@/lib/utils";
import { Github, Globe, Linkedin, Star, Twitter } from "lucide-react";

/** Read only star rating shown on a story card and in the story dialog. */
export function StarRating({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClass,
            value >= star
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/20"
          )}
        />
      ))}
    </div>
  );
}

/** Optional social profiles a member attached to their story. */
export function SocialLinks({ links }: { links: any }) {
  if (!links || typeof links !== "object") return null;

  const parsed =
    typeof links === "string"
      ? (() => {
          try {
            return JSON.parse(links);
          } catch {
            return null;
          }
        })()
      : links;
  if (!parsed) return null;

  const entries: { key: string; href: string; icon: React.ReactNode }[] = [];
  if (parsed.twitter)
    entries.push({ key: "twitter", href: parsed.twitter, icon: <Twitter className="h-3.5 w-3.5" /> });
  if (parsed.linkedin)
    entries.push({ key: "linkedin", href: parsed.linkedin, icon: <Linkedin className="h-3.5 w-3.5" /> });
  if (parsed.github)
    entries.push({ key: "github", href: parsed.github, icon: <Github className="h-3.5 w-3.5" /> });
  if (parsed.website)
    entries.push({ key: "website", href: parsed.website, icon: <Globe className="h-3.5 w-3.5" /> });

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-2">
      {entries.map((entry) => (
        <a
          key={entry.key}
          href={entry.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary inline-flex items-center justify-center rounded-full border p-1.5 transition-colors"
        >
          {entry.icon}
        </a>
      ))}
    </div>
  );
}

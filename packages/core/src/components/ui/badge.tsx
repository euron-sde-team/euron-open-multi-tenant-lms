import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

// Flat status label: a small coloured dot followed by the word. No filled
// chip, no border, no rounded box. Each variant maps to a dot colour.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-5 text-foreground",
  {
    variants: {
      variant: {
        default: "",
        secondary: "text-muted-foreground",
        destructive: "text-destructive",
        outline: "",
        success: "",
        warning: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const dotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    variant: {
      default: "bg-primary",
      secondary: "bg-muted-foreground/60",
      destructive: "bg-destructive",
      outline: "bg-muted-foreground/60",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

// Callers across the apps still pass chip styling (fills, borders, rounded
// corners, padding, gradients, shadows). Drop those tokens here so every badge
// stays flat without touching each call site. Text colours are kept, except
// the "on fill" ones (text-white, text-*-foreground) that only made sense on a
// filled background.
const CHIP_TOKEN =
  /^(bg-|border|rounded|shadow|ring|px-|py-|p-|from-|via-|to-|backdrop-|outline)/;
const ON_FILL_TEXT = /^text-(white|black|[a-z]+-foreground)$/;

function flattenClassName(className?: string): {
  className: string;
  hasTextColor: boolean;
  fillDot: string | null;
} {
  if (!className) return { className: "", hasTextColor: false, fillDot: null };
  let hadFill = false;
  let fillDot: string | null = null;
  const kept: string[] = [];
  for (const token of className.split(/\s+/)) {
    if (!token) continue;
    const base = token.slice(token.lastIndexOf(":") + 1);
    if (CHIP_TOKEN.test(base)) {
      if (base.startsWith("bg-") || base.startsWith("from-")) hadFill = true;
      // A saturated fill (bg-red-500, bg-primary) says what the status colour is.
      if (
        !fillDot &&
        base === token &&
        (/^bg-[a-z]+-[4-9]00$/.test(base) || /^bg-(primary|destructive)$/.test(base))
      ) {
        fillDot = base;
      }
      continue;
    }
    kept.push(token);
  }
  const filtered = hadFill
    ? kept.filter((t) => !ON_FILL_TEXT.test(t.slice(t.lastIndexOf(":") + 1)))
    : kept;
  const hasTextColor = filtered.some((t) => {
    const base = t.slice(t.lastIndexOf(":") + 1);
    return (
      /^text-[a-z]+-\d{2,3}(\/\d+)?$/.test(base) ||
      /^text-(primary|destructive)$/.test(base)
    );
  });
  return { className: filtered.join(" "), hasTextColor, fillDot };
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Lead with the status dot. On by default. */
  dot?: boolean;
}

function Badge({ className, variant, dot = true, children, ...props }: BadgeProps) {
  const flat = flattenClassName(className);
  return (
    <div className={cn(badgeVariants({ variant }), flat.className)} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn(
            dotVariants({ variant }),
            // A caller-supplied text colour (e.g. text-emerald-700) or a
            // saturated fill is the intended status colour: the dot follows it.
            flat.hasTextColor ? "bg-current" : flat.fillDot
          )}
        />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

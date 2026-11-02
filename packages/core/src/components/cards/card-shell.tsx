import * as React from "react";

import { cn } from "../../lib/utils";

// Storefront product cards (course/book tiles) are part of the tenant-chosen
// storefront look, so they keep their own framed shell instead of the flat
// admin Card section.
const ProductCardShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
ProductCardShell.displayName = "ProductCardShell";

export { ProductCardShell as Card };

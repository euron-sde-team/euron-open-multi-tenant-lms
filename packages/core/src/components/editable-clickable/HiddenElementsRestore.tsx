"use client";

/**
 * HiddenElementsRestore
 *
 * Displays a list of hidden clickable elements (buttons, links) for a section,
 * allowing the admin to restore any of them.
 *
 * Usage:
 *   <HiddenElementsRestore
 *     items={[
 *       { id: "primaryCta", label: "Primary Button", href: "/all-courses" },
 *       { id: "secondaryCta", label: "Secondary Button", href: "/" },
 *     ]}
 *     onRestore={(id) => handleRestore(id)}
 *   />
 */

import * as React from "react";
import { Eye, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatLinkForDisplay } from "@open-mtlms/shared";

// ============================================================================
// Props
// ============================================================================

export interface HiddenItem {
  /** Unique identifier for the hidden element slot */
  id: string;
  /** Display label (e.g. "Primary Button", "Twitter Link") */
  label: string;
  /** The href/link of the hidden element */
  href?: string;
}

export interface HiddenElementsRestoreProps {
  /** List of hidden elements */
  items: HiddenItem[];
  /** Called when admin wants to restore an element */
  onRestore: (id: string) => void;
  /** Called when admin wants to restore ALL elements */
  onRestoreAll?: () => void;
  /** Whether we're in edit mode */
  isEditing: boolean;
  /** Additional class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

function HiddenElementsRestore({
  items,
  onRestore,
  onRestoreAll,
  isEditing,
  className,
}: HiddenElementsRestoreProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Don't render if not editing or no hidden items
  if (!isEditing || items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20",
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors rounded-md"
      >
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          <span>
            {items.length} hidden {items.length === 1 ? "element" : "elements"}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Hidden Items List */}
      {isExpanded && (
        <div className="border-t border-amber-200/60 dark:border-amber-800/40 px-3 py-2 space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md bg-background/80 px-2.5 py-1.5 text-xs"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-foreground truncate">
                  {item.label}
                </span>
                {item.href && (
                  <span className="text-muted-foreground truncate">
                    {formatLinkForDisplay(item.href, 30)}
                  </span>
                )}
              </div>
              <button
                onClick={() => onRestore(item.id)}
                className="ml-2 flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Restore
              </button>
            </div>
          ))}

          {/* Restore All */}
          {items.length > 1 && onRestoreAll && (
            <button
              onClick={onRestoreAll}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Restore All
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { HiddenElementsRestore };

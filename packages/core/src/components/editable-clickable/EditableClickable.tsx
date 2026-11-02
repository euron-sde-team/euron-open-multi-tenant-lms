"use client";

/**
 * EditableClickable
 *
 * Universal wrapper for ANY clickable element (button, link, icon button, social icon).
 * In edit mode: shows destination tooltip on hover, opens link editor popover on click.
 * In view mode: renders children normally (no editing overhead).
 *
 * Usage:
 *   <EditableClickable
 *     href={content.primaryCta.href}
 *     onHrefChange={(newHref) => updateContent("primaryCta", { ...cta, href: newHref })}
 *     hidden={content.primaryCta.hidden}
 *     onHiddenChange={(hidden) => updateContent("primaryCta", { ...cta, hidden })}
 *     isEditing={isEditMode}
 *     slotLabel="Primary Button"
 *   >
 *     <Button variant="default">Get Started</Button>
 *   </EditableClickable>
 */

import * as React from "react";
import { Link as LinkIcon, ExternalLink, Eye, EyeOff, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  detectLinkType,
  formatLinkForDisplay,
  validateLink,
  getLinkPlaceholder,
  getLinkTypeLabel,
  isInternalLink,
  COMMON_INTERNAL_ROUTES,
} from "@open-mtlms/shared";
import { useAvailableRoutes } from "../available-routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";

// ============================================================================
// Props
// ============================================================================

export interface EditableClickableProps {
  /** Current href/link value */
  href: string;
  /** Called when the href changes */
  onHrefChange: (href: string) => void;
  /** Whether the element is hidden by admin */
  hidden?: boolean;
  /** Called when hidden state changes */
  onHiddenChange?: (hidden: boolean) => void;
  /** Whether we're in edit mode */
  isEditing: boolean;
  /** Human-readable label for the slot (e.g. "Primary Button", "Nav Link") */
  slotLabel?: string;
  /** The clickable child element */
  children: React.ReactNode;
  /** Additional class for the wrapper */
  className?: string;
  /** Whether to prevent navigation in edit mode (default: true) */
  preventNavigation?: boolean;
}

// ============================================================================
// Component
// ============================================================================

function EditableClickable({
  href,
  onHrefChange,
  hidden = false,
  onHiddenChange,
  isEditing,
  slotLabel,
  children,
  className,
  preventNavigation = true,
}: EditableClickableProps) {
  const { routes: availableRoutes } = useAvailableRoutes();
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [editValue, setEditValue] = React.useState(href);
  const [error, setError] = React.useState<string | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // Sync edit value with prop
  React.useEffect(() => {
    setEditValue(href);
  }, [href]);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (isPopoverOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isPopoverOpen]);

  const detectedType = detectLinkType(editValue);
  const displayText = formatLinkForDisplay(href);

  const handleClick = (e: React.MouseEvent) => {
    if (!isEditing) return; // Let normal behavior happen in view mode

    if (preventNavigation) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsPopoverOpen(true);
  };

  const handleSave = React.useCallback((): boolean => {
    const validationError = editValue.trim() ? validateLink(editValue.trim()) : null;
    if (validationError) {
      setError(validationError);
      return false;
    }
    setError(null);
    if (editValue.trim() !== href) {
      onHrefChange(editValue.trim());
    }
    setIsPopoverOpen(false);
    return true;
  }, [editValue, href, onHrefChange]);

  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      const succeeded = handleSaveRef.current();
      if (!succeeded) return; // Keep open on validation error
    }
    setIsPopoverOpen(open);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  const handleHide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onHiddenChange?.(true);
    setIsPopoverOpen(false);
  };

  // Filter suggestions based on input.
  // Use tenant-scoped available routes when provider is present, else fallback to COMMON_INTERNAL_ROUTES.
  const suggestions = React.useMemo(() => {
    if (!editValue.startsWith("/")) return [];
    const source =
      availableRoutes.length > 0 ? availableRoutes : COMMON_INTERNAL_ROUTES;
    return source.filter(
      (route) =>
        route.path.toLowerCase().includes(editValue.toLowerCase()) ||
        route.label.toLowerCase().includes(editValue.toLowerCase().replace(/^\/+/, ""))
    );
  }, [editValue, availableRoutes]);

  // If hidden in view mode, don't render
  if (hidden && !isEditing) {
    return null;
  }

  // View mode, just render children
  if (!isEditing) {
    return <>{children}</>;
  }

  // Edit mode, wrapped with editing UI
  return (
    <div
      ref={wrapperRef}
      className={cn("relative inline-flex group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The actual clickable element */}
      <div
        className={cn(
          "relative",
          hidden && "opacity-40 pointer-events-none",
          isEditing && "cursor-pointer",
          isEditing && !isPopoverOpen && "ring-1 ring-dashed ring-blue-400/50 rounded-md hover:ring-blue-500/80"
        )}
        onClick={handleClick}
      >
        {children}

        {/* Edit indicator badge */}
        {isEditing && !isPopoverOpen && (
          <div className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
            <LinkIcon className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* Hidden overlay */}
      {hidden && isEditing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-[1px]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHiddenChange?.(false);
            }}
            className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors"
          >
            <Eye className="h-3 w-3" />
            Restore
          </button>
        </div>
      )}

      {/* Destination Tooltip (on hover, when popover is closed) */}
      {isHovered && !isPopoverOpen && !hidden && isEditing && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg pointer-events-none">
          <div className="flex items-center gap-1">
            {isInternalLink(href) ? (
              <LinkIcon className="h-3 w-3 shrink-0" />
            ) : (
              <ExternalLink className="h-3 w-3 shrink-0" />
            )}
            <span className="max-w-[200px] truncate">{displayText}</span>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 bg-foreground" />
        </div>
      )}

      {/* Link Editor Dialog - Shadcn Dialog for best UX */}
      <Dialog open={isPopoverOpen} onOpenChange={handleOpenChange}>
        <DialogContent hideCloseButton className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <LinkIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {slotLabel ?? "Link"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set the destination for this button
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onHiddenChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleHide}
                  title="Hide this element"
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleSave()}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Link type
              </Label>
              <Badge variant="secondary" className="font-normal">
                {getLinkTypeLabel(detectedType)}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link-input">
                {detectedType === "internal" ? "Internal Page" : "URL or path"}
              </Label>
              <div className="relative">
                <Input
                  id="link-input"
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    setError(null);
                    setShowSuggestions(e.target.value.startsWith("/"));
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(editValue.startsWith("/"))}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={getLinkPlaceholder(detectedType)}
                  className={cn(
                    "pr-3",
                    error && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-md">
                    <div className="p-1">
                      {suggestions.map((route) => (
                          <button
                            key={route.path}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEditValue(route.path);
                              setShowSuggestions(false);
                              setError(null);
                            }}
                          >
                            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 font-medium">{route.label}</span>
                            <span className="text-xs text-muted-foreground">{route.path}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1 py-0.5">/</code> for pages,{" "}
              <code className="rounded bg-muted px-1 py-0.5">https://</code> for external,{" "}
              <code className="rounded bg-muted px-1 py-0.5">#</code> for scroll
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditValue(href);
                setError(null);
                setIsPopoverOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSave()}>
              Save Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { EditableClickable };

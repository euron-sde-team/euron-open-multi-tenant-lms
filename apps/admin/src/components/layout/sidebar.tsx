"use client";

import { Button, ScrollArea } from "@open-mtlms/core";
import type { LayoutSidebar, SidebarNavItem, SidebarWidget } from "@open-mtlms/shared";
import {
  BookOpen,
  BookText,
  Bot,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Crown,
  ExternalLink,
  FileText,
  FolderTree,
  GraduationCap,
  Home,
  Layers,
  LayoutGrid,
  Map,
  MessageCircle,
  Package,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";

import { cn } from "@/lib/utils";

// Icon mapping (synced with web: layout-grid=All Courses, book-open=Self Paced, book-text=Books, folder-tree=Categories)
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  community: Users,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  video: Video,
  "book-open": BookOpen,
  "book-text": BookText,
  radio: Radio,
  layers: Layers,
  "layout-grid": LayoutGrid,
  sparkles: Sparkles,
  map: Map,
  crown: Crown,
  "message-circle": MessageCircle,
  code: Code,
  "file-text": FileText,
  search: Search,
  bot: Bot,
  trophy: Trophy,
  zap: Zap,
  package: Package,
  "folder-tree": FolderTree,
};

// Badge variant styles
const badgeVariants: Record<string, string> = {
  new: "bg-emerald-500",
  free: "bg-sky-500",
  popular: "bg-amber-500",
  beta: "bg-violet-500",
  pro: "bg-amber-500",
};

interface SidebarProps {
  config: LayoutSidebar;
  logo?: string;
  logoAlt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Start collapsed, respects template config */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Drawer variant: hides collapse button, full width */
  variant?: "sidebar" | "drawer";
  /** Callback when nav link is clicked (for drawer close on mobile) */
  onNavClick?: () => void;
}

export function Sidebar({
  config,
  logo,
  logoAlt = "Logo",
  className,
  style: styleProp,
  defaultCollapsed = false,
  onCollapsedChange,
  variant = "sidebar",
  onNavClick,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (!config.enabled) return null;

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const isDrawer = variant === "drawer";
  const currentWidth = isDrawer ? "280px" : isCollapsed ? "64px" : config.width || "280px";

  const renderNavItem = (item: SidebarNavItem, depth = 0) => {
    const Icon = item.icon ? iconMap[item.icon] : null;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const displayLabel =
      item.label ?? (item as { title?: string }).title ?? item.id ?? "";

    return (
      <div key={item.id}>
        <Link
          href={item.href}
          target={item.isExternal ? "_blank" : undefined}
          rel={item.isExternal ? "noopener noreferrer" : undefined}
          title={isCollapsed ? displayLabel : undefined}
          className={cn(
            "flex flex-nowrap items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            depth > 0 && "text-muted-foreground ml-6",
            isCollapsed && "justify-center px-2 w-full"
          )}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.id);
            } else if (onNavClick) {
              onNavClick();
            }
          }}
        >
          {Icon && (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center self-center transition-all",
                isCollapsed ? "size-5" : "h-4 w-4 min-w-4"
              )}
            >
              <Icon
                className={cn(
                  "shrink-0",
                  isCollapsed ? "size-5" : "h-full w-full"
                )}
              />
            </span>
          )}
          {!isCollapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
              {item.badge && (
                <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      badgeVariants[item.badge.variant] || "bg-muted-foreground/60"
                    )}
                  />
                  {item.badge.text}
                </span>
              )}
              {item.isExternal && <ExternalLink className="text-muted-foreground h-3 w-3" />}
              {hasChildren && (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                />
              )}
            </>
          )}
        </Link>

        {/* Children */}
        {hasChildren && isExpanded && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderWidget = (widget: SidebarWidget) => {
    if (!widget.visible) return null;

    switch (widget.type) {
      case "social-links":
        return (
          <div key={widget.id} className="px-3 py-4">
            {widget.title && (
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                {widget.title}
              </h4>
            )}
            <div className="flex gap-2">
              {widget.content.socialLinks?.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bg-accent rounded-lg p-2"
                >
                  <span className="sr-only">{link.platform}</span>
                </a>
              ))}
            </div>
          </div>
        );

      case "newsletter":
        return (
          <div key={widget.id} className="px-3 py-4">
            {widget.content.newsletterTitle && (
              <h4 className="mb-1 text-sm font-semibold">{widget.content.newsletterTitle}</h4>
            )}
            {widget.content.newsletterDescription && (
              <p className="text-muted-foreground mb-3 text-xs">
                {widget.content.newsletterDescription}
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder={widget.content.newsletterPlaceholder || "Enter email"}
                className="bg-background flex-1 rounded-md border px-3 py-1.5 text-sm"
              />
              <Button size="sm">{widget.content.newsletterButtonText || "Subscribe"}</Button>
            </div>
          </div>
        );

      case "contact-info":
        return (
          <div key={widget.id} className="px-3 py-4">
            {widget.title && (
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                {widget.title}
              </h4>
            )}
            <div className="space-y-1 text-sm">
              {widget.content.email && (
                <p className="text-muted-foreground">{widget.content.email}</p>
              )}
              {widget.content.phone && (
                <p className="text-muted-foreground">{widget.content.phone}</p>
              )}
              {widget.content.address && (
                <p className="text-muted-foreground">{widget.content.address}</p>
              )}
            </div>
          </div>
        );

      case "banner":
        return widget.content.bannerImage ? (
          <div key={widget.id} className="px-3 py-4">
            <a href={widget.content.bannerLink || "#"} target="_blank" rel="noopener noreferrer">
              <Image
                src={widget.content.bannerImage}
                alt={widget.content.bannerAlt || "Banner"}
                width={240}
                height={120}
                className="rounded-lg object-cover"
              />
            </a>
          </div>
        ) : null;

      case "custom-html":
        return widget.content.html ? (
          <div
            key={widget.id}
            className="px-3 py-4"
            dangerouslySetInnerHTML={{ __html: widget.content.html }}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <aside
      className={cn(
        "bg-card z-10 flex h-full shrink-0 flex-col border-r transition-all duration-300",
        className
      )}
      style={{ width: currentWidth, minWidth: currentWidth, ...styleProp }}
    >
      {/* Logo - only shown if showLogo is true and logo is provided */}
      {config.showLogo !== false && logo && (
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b px-4",
            isCollapsed && "justify-center px-2"
          )}
        >
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={logo}
              alt={logoAlt}
              width={
                isCollapsed
                  ? 32
                  : config.logoSize === "lg"
                    ? 48
                    : config.logoSize === "sm"
                      ? 24
                      : 32
              }
              height={
                isCollapsed
                  ? 32
                  : config.logoSize === "lg"
                    ? 48
                    : config.logoSize === "sm"
                      ? 24
                      : 32
              }
              className="object-contain dark:invert"
            />
            {!isCollapsed && <span className="text-lg font-bold">{logoAlt}</span>}
          </Link>
        </div>
      )}

      {/* Navigation - min-h-0 allows flex to shrink so Collapse button stays at bottom */}
      <ScrollArea className="min-h-0 flex-1 px-2 py-4">
        <nav className="space-y-1">{config.navItems.map((item) => renderNavItem(item))}</nav>

        {/* Widgets */}
        {!isCollapsed && config.widgets.length > 0 && (
          <div className="mt-6 border-t pt-4">
            {config.widgets.sort((a, b) => a.order - b.order).map(renderWidget)}
          </div>
        )}
      </ScrollArea>

      {/* Collapse button - hidden in drawer variant */}
      {config.collapsible && !isDrawer && (
        <div className="mt-auto shrink-0 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={handleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}

// Export the default sidebar width for use in other components
export const SIDEBAR_WIDTH = "280px";
export const SIDEBAR_COLLAPSED_WIDTH = "64px";

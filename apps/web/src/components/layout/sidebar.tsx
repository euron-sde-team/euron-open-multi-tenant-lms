"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { SafeLink, Tooltip, TooltipContent, TooltipTrigger } from "@open-mtlms/core";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LayoutSidebar, SidebarNavItem, SidebarWidget } from "@open-mtlms/shared";
import {
  Activity,
  Award,
  BarChart2,
  Bell,
  Bookmark,
  BookOpen,
  BookText,
  Bot,
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  Code,
  Cpu,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Film,
  Folder,
  FolderTree,
  Gift,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link,
  Lock,
  Mail,
  Map,
  MessageCircle,
  MessageSquare,
  Mic,
  Monitor,
  Music,
  Newspaper,
  Package,
  Phone,
  PieChart,
  PlayCircle,
  Radio,
  Rocket,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Video,
  Wallet,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Icon mapping, must stay in sync with SIDEBAR_ICON_REGISTRY in @open-mtlms/shared
const iconMap: Record<string, LucideIcon> = {
  // Navigation & Layout
  home: Home,
  "layout-dashboard": LayoutDashboard,
  "layout-grid": LayoutGrid,
  // Learning & Courses
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  "book-text": BookText,
  "play-circle": PlayCircle,
  monitor: Monitor,
  video: Video,
  radio: Radio,
  layers: Layers,
  "folder-tree": FolderTree,
  // Assessment & Achievement
  trophy: Trophy,
  award: Award,
  target: Target,
  // AI & Intelligence
  sparkles: Sparkles,
  bot: Bot,
  zap: Zap,
  cpu: Cpu,
  "wand-2": Wand2,
  lightbulb: Lightbulb,
  // Content & Media
  "file-text": FileText,
  newspaper: Newspaper,
  image: ImageIcon,
  film: Film,
  music: Music,
  headphones: Headphones,
  bookmark: Bookmark,
  // Commerce & Monetization
  package: Package,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  tag: Tag,
  "credit-card": CreditCard,
  wallet: Wallet,
  gift: Gift,
  // Communication
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  mail: Mail,
  phone: Phone,
  mic: Mic,
  bell: Bell,
  // Analytics & Reporting
  "bar-chart-2": BarChart2,
  "trending-up": TrendingUp,
  activity: Activity,
  "pie-chart": PieChart,
  // People & Teams
  users: Users,
  community: Users,
  briefcase: Briefcase,
  crown: Crown,
  star: Star,
  heart: Heart,
  // System & Settings
  settings: Settings,
  shield: Shield,
  lock: Lock,
  globe: Globe,
  code: Code,
  link: Link,
  search: Search,
  folder: Folder,
  // Time & Planning
  calendar: Calendar,
  clock: Clock,
  map: Map,
  // Growth & Misc
  rocket: Rocket,
};

// Badge variant styles
const badgeVariants: Record<string, string> = {
  new: "bg-emerald-500 text-white",
  free: "bg-blue-500 text-white",
  popular: "bg-amber-500 text-white",
  beta: "bg-purple-500 text-white",
  pro: "bg-gradient-to-r from-amber-400 to-amber-600 text-white",
};

interface SidebarProps {
  config: LayoutSidebar;
  logo?: string;
  logoAlt?: string;
  className?: string;
  /** Drawer variant: full width, no hover-expand */
  variant?: "sidebar" | "drawer";
  /** Callback when nav link is clicked (for drawer close on mobile) */
  onNavClick?: () => void;
}

export function Sidebar({
  config,
  logo,
  logoAlt = "Logo",
  className,
  variant = "sidebar",
  onNavClick,
}: SidebarProps) {
  const [, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDrawer = variant === "drawer";
  const isCollapsed = isDrawer ? false : !isHovered;

  const handleMouseEnter = useCallback(() => {
    if (isDrawer) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  }, [isDrawer]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawer) return;
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  }, [isDrawer]);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

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

  const currentWidth = isDrawer ? "280px" : isCollapsed ? "64px" : config.width || "280px";

  const renderNavItem = (item: SidebarNavItem, depth = 0) => {
    const Icon = item.icon ? iconMap[item.icon] : null;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const displayLabel = item.label ?? (item as { title?: string }).title ?? item.id ?? "";

    const linkContent = (
      <SafeLink
        href={item.href}
        openInNewTab={item.isExternal}
        className={cn(
          "flex flex-nowrap items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "hover:bg-muted",
          "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          depth > 0 && "text-muted-foreground ml-6",
          isCollapsed && "w-full justify-center px-2"
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
            <Icon className={cn("shrink-0", isCollapsed ? "size-5" : "h-full w-full")} />
          </span>
        )}
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
            {item.badge && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  badgeVariants[item.badge.variant] || "bg-muted"
                )}
              >
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
      </SafeLink>
    );

    return (
      <div key={item.id}>
        {isCollapsed ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span className="inline-flex w-full">{linkContent}</span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {displayLabel}
            </TooltipContent>
          </Tooltip>
        ) : (
          linkContent
        )}

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
                  className="hover:bg-muted rounded-lg p-2"
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
                unoptimized
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
        "bg-background z-40 flex h-full shrink-0 flex-col overflow-hidden border-r transition-all duration-300",
        !isDrawer && isHovered && "shadow-xl",
        className
      )}
      style={{ width: currentWidth, minWidth: currentWidth }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo - only shown if showLogo is true and logo is provided */}
      {config.showLogo !== false && logo && (
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b px-4",
            isCollapsed && "justify-center px-2"
          )}
        >
          <SafeLink href="/" className="flex items-center gap-2">
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
              className="object-contain"
              unoptimized
            />
            {!isCollapsed && <span className="text-lg font-bold">{logoAlt}</span>}
          </SafeLink>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">{config.navItems.map((item) => renderNavItem(item))}</nav>

        {/* Widgets */}
        {!isCollapsed && config.widgets.length > 0 && (
          <div className="mt-6 border-t pt-4">
            {config.widgets.sort((a, b) => a.order - b.order).map(renderWidget)}
          </div>
        )}
      </ScrollArea>

    </aside>
  );
}

// Export the default sidebar width for use in other components
export const SIDEBAR_WIDTH = "280px";
export const SIDEBAR_COLLAPSED_WIDTH = "64px";

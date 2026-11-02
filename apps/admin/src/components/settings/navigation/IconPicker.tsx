"use client";

import { cn, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@open-mtlms/core";
import { SIDEBAR_ICON_REGISTRY } from "@open-mtlms/shared";
import {
  Activity,
  Award,
  BarChart2,
  Bell,
  BookOpen,
  Bookmark,
  Bot,
  Briefcase,
  Calendar,
  Clock,
  Code,
  Cpu,
  CreditCard,
  Crown,
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
  Image,
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
  BookText,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const iconComponents: Record<string, LucideIcon> = {
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
  image: Image,
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

/**
 * Render a single sidebar icon by its registry name (e.g. "package"). Returns
 * null for an unknown/empty name so callers can fall back to text. Shared by the
 * picker grid and the editor trigger buttons so a selected icon shows as its
 * glyph rather than raw text.
 */
export function NavIcon({
  name,
  className = "h-4 w-4",
}: {
  name?: string | null;
  className?: string;
}) {
  if (!name) return null;
  const Icon = iconComponents[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [filter, setFilter] = useState("");

  const filteredIcons = useMemo(() => {
    if (!filter) return SIDEBAR_ICON_REGISTRY;
    const lower = filter.toLowerCase();
    return SIDEBAR_ICON_REGISTRY.filter(
      (icon) =>
        icon.name.includes(lower) || icon.label.toLowerCase().includes(lower)
    );
  }, [filter]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search icons..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-8 gap-1">
        <TooltipProvider delayDuration={200}>
          {filteredIcons.map((icon) => {
            const Icon = iconComponents[icon.name];
            if (!Icon) return null;
            const isSelected = value === icon.name;
            return (
              <Tooltip key={icon.name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => onChange(icon.name)}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {icon.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

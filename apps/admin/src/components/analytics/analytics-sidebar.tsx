"use client";

import { Button, cn, ScrollArea } from "@open-mtlms/core";
import {
  Award,
  BarChart3,
  BookMarked,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ClipboardCheck,
  CreditCard,
  Download,
  FileBarChart,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  Package,
  PlayCircle,
  ShoppingCart,
  Ticket,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exactMatch?: boolean;
}

const ANALYTICS_NAV: NavItem[] = [
  { href: "/dashboard/analytics", label: "Overview", icon: BarChart3, exactMatch: true },
  { href: "/dashboard/analytics/web-analytics", label: "Web Vitals", icon: Globe },
  { href: "/dashboard/analytics/users", label: "Users", icon: Users },
  { href: "/dashboard/analytics/courses-analytics", label: "Courses", icon: GraduationCap },
  { href: "/dashboard/analytics/assignments-analytics", label: "Assignments", icon: FileText },
  { href: "/dashboard/analytics/books-analytics", label: "Books", icon: BookOpen },
  { href: "/dashboard/analytics/bundles-analytics", label: "Bundles", icon: Package },
  { href: "/dashboard/analytics/payments", label: "Payments & Revenue", icon: CreditCard },
  { href: "/dashboard/analytics/certificates-analytics", label: "Certificates", icon: Award },
  { href: "/dashboard/analytics/coupons-analytics", label: "Coupons", icon: Ticket },
  { href: "/dashboard/analytics/quizzes-analytics", label: "Quizzes", icon: Trophy },
  { href: "/dashboard/analytics/test-series-analytics", label: "Test Series", icon: ClipboardCheck },
  { href: "/dashboard/analytics/engagement", label: "Engagement", icon: Video },
  { href: "/dashboard/analytics/watch-time", label: "Video Watch", icon: PlayCircle },
  { href: "/dashboard/analytics/book-reading", label: "Book Reading", icon: BookMarked },
  { href: "/dashboard/analytics/cart-analytics", label: "Cart", icon: ShoppingCart },
  { href: "/dashboard/analytics/bookmarks-analytics", label: "Bookmarks", icon: Bookmark },
  { href: "/dashboard/analytics/download-reports", label: "Download Reports", icon: Download },
  { href: "/dashboard/analytics/enhanced-reports", label: "Enhanced Reports", icon: FileBarChart },
];

interface AnalyticsSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function AnalyticsSidebar({ collapsed, onToggle, className }: AnalyticsSidebarProps) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      <div className={cn(
        "flex items-center gap-2 border-b px-3 py-3 shrink-0",
        collapsed && "justify-center px-2"
      )}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Back to Dashboard</span>}
        </Link>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b shrink-0">
          <h2 className="text-sm font-semibold tracking-tight">Analytics</h2>
          <p className="text-xs text-muted-foreground">Business Intelligence</p>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <nav className="space-y-0.5 px-2 py-2">
          {ANALYTICS_NAV.map((item) => {
            const isActive = item.exactMatch
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {onToggle && (
        <div className="border-t p-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onToggle}
          >
            <Layers className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      )}
    </aside>
  );
}

"use client";

import React from "react";
import {
  BookOpen,
  FileText,
  Star,
  Info,
  List,
} from "lucide-react";
import { cn } from "../../lib/utils";

export type LessonTabId = "overview" | "resources" | "ratings" | "notes" | "content";

interface Tab {
  id: LessonTabId;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

interface LessonTabsProps {
  /** Currently active tab */
  activeTab: LessonTabId;
  /** Called when tab changes */
  onTabChange: (tab: LessonTabId) => void;
  /** Available tabs (defaults to overview, resources, ratings) */
  tabs?: LessonTabId[];
  /** Tab content */
  children: React.ReactNode;
  /** Variant style */
  variant?: "default" | "pills" | "underline";
  /** Additional class name */
  className?: string;
}

const ALL_TABS: Tab[] = [
  { id: "content", label: "Content", icon: List },
  { id: "overview", label: "Overview", icon: Info },
  { id: "resources", label: "Resources", icon: FileText },
  { id: "ratings", label: "Review", icon: Star },
  { id: "notes", label: "Notes", icon: BookOpen },
];

export function LessonTabs({
  activeTab,
  onTabChange,
  tabs = ["overview", "resources", "ratings"],
  children,
  variant = "default",
  className,
}: LessonTabsProps) {
  const availableTabs = ALL_TABS.filter((tab) => tabs.includes(tab.id));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tab Headers */}
      <div
        className={cn(
          "flex",
          variant === "default" && "border-b",
          variant === "pills" && "gap-2 p-1 bg-muted rounded-lg",
          variant === "underline" && "gap-6 border-b"
        )}
        role="tablist"
      >
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              disabled={tab.disabled}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.id}`}
              className={cn(
                "flex items-center gap-2 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                // Default variant
                variant === "default" &&
                  cn(
                    "px-4 py-2.5 text-sm font-medium -mb-px border-b-2",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  ),
                // Pills variant
                variant === "pills" &&
                  cn(
                    "px-4 py-2 text-sm font-medium rounded-md flex-1 justify-center",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  ),
                // Underline variant
                variant === "underline" &&
                  cn(
                    "pb-3 text-sm font-medium border-b-2 -mb-px",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div
        role="tabpanel"
        id={`tab-panel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {children}
      </div>
    </div>
  );
}

export default LessonTabs;

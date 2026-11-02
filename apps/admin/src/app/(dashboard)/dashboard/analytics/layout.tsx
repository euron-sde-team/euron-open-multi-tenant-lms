"use client";

import { Button, cn } from "@open-mtlms/core";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { AnalyticsSidebar } from "@/components/analytics/analytics-sidebar";
import {
  DateRangePicker,
  useDefaultDateRange,
  type DateRange,
} from "@/components/analytics/date-range-picker";
import { AnalyticsDateRangeProvider } from "@/lib/contexts/analytics-date-range-context";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(useDefaultDateRange);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <AnalyticsDateRangeProvider value={{ dateRange, refreshKey }}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 top-0 z-50 transform transition-transform duration-200 lg:relative lg:inset-auto lg:top-auto lg:z-auto lg:transform-none",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <AnalyticsSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
          />
          {/* Mobile close */}
          {mobileOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Analytics header bar */}
          <div className="relative z-30 flex items-center justify-between gap-4 border-b bg-background/95 backdrop-blur px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </div>
        </div>
      </div>
    </AnalyticsDateRangeProvider>
  );
}

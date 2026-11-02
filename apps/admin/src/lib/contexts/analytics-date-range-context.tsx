"use client";

import { createContext, useContext } from "react";

import type { DateRange } from "@/components/analytics/date-range-picker";

interface AnalyticsDateRangeContextValue {
  dateRange: DateRange;
  refreshKey: number;
}

const AnalyticsDateRangeContext = createContext<AnalyticsDateRangeContextValue | null>(null);

export function AnalyticsDateRangeProvider({
  value,
  children,
}: {
  value: AnalyticsDateRangeContextValue;
  children: React.ReactNode;
}) {
  return (
    <AnalyticsDateRangeContext.Provider value={value}>
      {children}
    </AnalyticsDateRangeContext.Provider>
  );
}

export function useAnalyticsDateRange(): AnalyticsDateRangeContextValue {
  const ctx = useContext(AnalyticsDateRangeContext);
  if (!ctx) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return {
      dateRange: {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
        label: "Last 30 Days",
      },
      refreshKey: 0,
    };
  }
  return ctx;
}

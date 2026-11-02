"use client";

import { Button, cn } from "@open-mtlms/core";
import { Calendar, ChevronDown, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface DateRange {
  startDate: string;
  endDate: string;
  label?: string;
  compareStartDate?: string;
  compareEndDate?: string;
  compareEnabled?: boolean;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: string): DateRange {
  const now = new Date();
  const end = toISODate(now);

  switch (preset) {
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { startDate: toISODate(start), endDate: end, label: "This Week" };
    }
    case "15d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 15);
      return { startDate: toISODate(start), endDate: end, label: "Last 15 Days" };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: toISODate(start), endDate: end, label: "Last 30 Days" };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toISODate(start), endDate: end, label: "This Month" };
    }
    case "60d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 60);
      return { startDate: toISODate(start), endDate: end, label: "Last 60 Days" };
    }
    case "this_quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      return { startDate: toISODate(start), endDate: end, label: "This Quarter" };
    }
    case "ytd": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: toISODate(start), endDate: end, label: "Year to Date" };
    }
    case "1y": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { startDate: toISODate(start), endDate: end, label: "Last Year" };
    }
    case "lifetime": {
      return { startDate: "1970-01-01", endDate: end, label: "Lifetime" };
    }
    default: {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { startDate: toISODate(start), endDate: end, label: "Last 30 Days" };
    }
  }
}

/**
 * Compute the previous period of equal duration for comparison.
 */
export function computePreviousPeriod(range: DateRange): { startDate: string; endDate: string } {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { startDate: toISODate(prevStart), endDate: toISODate(prevEnd) };
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onRefresh?: () => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, onRefresh, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomStart(value.startDate);
    setCustomEnd(value.endDate);
  }, [value.startDate, value.endDate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreset = useCallback((preset: string) => {
    onChange(getPresetRange(preset));
    setOpen(false);
  }, [onChange]);

  const handleApplyCustom = useCallback(() => {
    if (customStart && customEnd) {
      onChange({
        startDate: customStart,
        endDate: customEnd,
        label: `${formatDateDisplay(customStart)} - ${formatDateDisplay(customEnd)}`,
      });
      setOpen(false);
    }
  }, [customStart, customEnd, onChange]);

  const displayLabel = value.label
    || `${formatDateDisplay(value.startDate)} - ${formatDateDisplay(value.endDate)}`;

  return (
    <div className={cn("relative", className)} ref={ref}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs h-9"
          onClick={() => setOpen(!open)}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{displayLabel}</span>
          <span className="sm:hidden">Range</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </Button>
        {onRefresh && (
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-popover p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Quick Select</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "7d", label: "This Week" },
                  { key: "15d", label: "Last 15 Days" },
                  { key: "30d", label: "Last 30 Days" },
                  { key: "this_month", label: "This Month" },
                  { key: "60d", label: "Last 60 Days" },
                  { key: "this_quarter", label: "This Quarter" },
                  { key: "ytd", label: "Year to Date" },
                  { key: "1y", label: "Last Year" },
                  { key: "lifetime", label: "Lifetime" },
                ].map((p) => (
                  <Button
                    key={p.key}
                    variant={value.label === p.label ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handlePreset(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Custom Range</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleApplyCustom}
                  disabled={!customStart || !customEnd}
                >
                  Apply Custom Range
                </Button>
              </div>
            </div>

            <div className="border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.compareEnabled ?? false}
                  onChange={(e) => {
                    const compareEnabled = e.target.checked;
                    if (compareEnabled) {
                      const prev = computePreviousPeriod(value);
                      onChange({ ...value, compareEnabled, compareStartDate: prev.startDate, compareEndDate: prev.endDate });
                    } else {
                      onChange({ ...value, compareEnabled, compareStartDate: undefined, compareEndDate: undefined });
                    }
                    setOpen(false);
                  }}
                  className="h-3.5 w-3.5 rounded border-muted-foreground"
                />
                <span className="text-xs font-medium">Compare with previous period</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function useDefaultDateRange(): DateRange {
  return getPresetRange("30d");
}

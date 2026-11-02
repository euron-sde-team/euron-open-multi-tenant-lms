"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, formatChartDate } from "./chart-utils";
import type { DailyDataPoint } from "./chart-components";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

interface ComparisonChartProps {
  title: string;
  description?: string;
  currentData: DailyDataPoint[];
  previousData: DailyDataPoint[];
  dataKey?: string;
  currentLabel?: string;
  previousLabel?: string;
  height?: number;
}

/**
 * Aligns previous-period data onto the same x-axis as current-period data
 * by shifting dates forward to match positions.
 */
function alignPeriods(
  currentData: DailyDataPoint[],
  previousData: DailyDataPoint[],
  dataKey: string,
): Array<{ date: string; current: number; previous: number }> {
  const maxLen = Math.max(currentData.length, previousData.length);
  const result: Array<{ date: string; current: number; previous: number }> = [];

  for (let i = 0; i < maxLen; i++) {
    const curr = currentData[i];
    const prev = previousData[i];
    result.push({
      date: curr?.date ?? prev?.date ?? "",
      current: Number(curr?.[dataKey] ?? 0),
      previous: Number(prev?.[dataKey] ?? 0),
    });
  }

  return result;
}

export function ComparisonChart({
  title,
  description,
  currentData,
  previousData,
  dataKey = "count",
  currentLabel = "This Period",
  previousLabel = "Previous Period",
  height = 220,
}: ComparisonChartProps) {
  if (currentData.length === 0 && previousData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-10 text-center">No data for selected range</p>
        </CardContent>
      </Card>
    );
  }

  const aligned = alignPeriods(currentData, previousData, dataKey);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={aligned} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="current"
              name={currentLabel}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={previousLabel}
              stroke={CHART_COLORS[2]}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

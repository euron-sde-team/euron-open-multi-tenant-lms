"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, formatChartDate } from "./chart-utils";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export interface DailyDataPoint {
  date: string;
  count?: number;
  amount?: number;
  [key: string]: string | number | undefined;
}

interface LineSeries {
  dataKey: string;
  name: string;
  color?: string;
  yAxisId?: string;
}

interface AnalyticsLineChartProps {
  title: string;
  description?: string;
  data: DailyDataPoint[];
  dataKey?: string;
  name?: string;
  lines?: LineSeries[];
  height?: number;
}

export function AnalyticsLineChart({
  title,
  description,
  data,
  dataKey = "count",
  name = "Count",
  lines,
  height = 220,
}: AnalyticsLineChartProps) {
  if (data.length === 0) {
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

  const lineSeries = lines ?? [{ dataKey, name, color: CHART_COLORS[0] }];
  const hasRightAxis = lineSeries.some((l) => l.yAxisId === "right");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: hasRightAxis ? 40 : 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={formatChartDate}
              className="text-muted-foreground"
            />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            {hasRightAxis && (
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="text-muted-foreground" />
            )}
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              labelFormatter={(label) => formatChartDate(String(label ?? ""))}
            />
            {lineSeries.map((l, i) => (
              <Line
                key={l.dataKey}
                type="monotone"
                dataKey={l.dataKey}
                stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={l.name}
                yAxisId={l.yAxisId ?? "left"}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface BarSeries {
  dataKey: string;
  name: string;
  color?: string;
}

interface AnalyticsBarChartProps {
  title: string;
  description?: string;
  data: DailyDataPoint[];
  dataKey?: string;
  name?: string;
  bars?: BarSeries[];
  height?: number;
  layout?: "horizontal" | "vertical";
}

export function AnalyticsBarChart({
  title,
  description,
  data,
  dataKey = "count",
  name = "Count",
  bars,
  height = 220,
  layout = "horizontal",
}: AnalyticsBarChartProps) {
  if (data.length === 0) {
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

  const barSeries = bars ?? [{ dataKey, name, color: CHART_COLORS[0] }];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout={layout}
            margin={layout === "vertical" ? { top: 5, right: 20, bottom: 5, left: 24 } : { top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            {layout === "horizontal" ? (
              <>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={formatChartDate}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
              </>
            ) : (
              <>
                <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  width={160}
                  className="text-muted-foreground"
                  tickFormatter={(value) => {
                    const s = String(value ?? "");
                    return s.length > 22 ? `${s.slice(0, 22)}…` : s;
                  }}
                />
              </>
            )}
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              labelFormatter={
                layout === "horizontal"
                  ? (label) => formatChartDate(String(label ?? ""))
                  : (label) => String(label ?? "")
              }
            />
            {barSeries.map((b, i) => (
              <Bar
                key={b.dataKey}
                dataKey={b.dataKey}
                fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                name={b.name}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface AnalyticsAreaChartProps {
  title: string;
  description?: string;
  data: DailyDataPoint[];
  dataKey?: string;
  name?: string;
  height?: number;
  color?: string;
}

export function AnalyticsAreaChart({
  title,
  description,
  data,
  dataKey = "count",
  name = "Count",
  height = 220,
  color = CHART_COLORS[1],
}: AnalyticsAreaChartProps) {
  if (data.length === 0) {
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

  const gradientId = `areaGrad-${title.replace(/\s/g, "-")}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={formatChartDate}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              labelFormatter={(label) => formatChartDate(String(label ?? ""))}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} name={name} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface PieDataPoint {
  name: string;
  value: number;
}

interface AnalyticsPieChartProps {
  title: string;
  description?: string;
  data: PieDataPoint[];
  height?: number;
}

export function AnalyticsPieChart({
  title,
  description,
  data,
  height = 220,
}: AnalyticsPieChartProps) {
  if (data.length === 0) {
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${String(name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "hsl(var(--foreground))" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

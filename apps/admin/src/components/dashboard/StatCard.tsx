"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@open-mtlms/core";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center pb-1 pt-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        {trend && (
          <p
            className={`text-xs ${trend.positive ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            {trend.value}
          </p>
        )}
        {subtitle && !trend && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

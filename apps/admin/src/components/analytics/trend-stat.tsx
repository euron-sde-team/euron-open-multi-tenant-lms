"use client";

import { Card, CardContent, CardHeader, cn } from "@open-mtlms/core";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatNumber, formatCurrency, formatPercent, formatDuration, calcPercentChange } from "./number-formatters";

interface TrendStatProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: "number" | "currency" | "percent" | "duration";
  currencySymbol?: string;
  subtitle?: string;
  icon?: React.ElementType;
  accentColor?: string;
  size?: "hero" | "mini" | "default";
}

function formatValue(value: number, format: TrendStatProps["format"], currencySymbol?: string): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currencySymbol);
    case "percent":
      return formatPercent(value);
    case "duration":
      return formatDuration(value);
    default:
      return formatNumber(value);
  }
}

export function TrendStat({
  title,
  value,
  previousValue,
  format = "number",
  currencySymbol,
  subtitle,
  icon: Icon,
  accentColor,
  size = "default",
}: TrendStatProps) {
  const change = previousValue !== undefined ? calcPercentChange(value, previousValue) : null;
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;
  const isNeutral = change === null || change === 0;

  const isHero = size === "hero";
  const isMini = size === "mini";

  return (
    <Card className={cn("relative overflow-hidden", isMini && "")}>
      {accentColor && (
        <div className={cn("absolute left-0 top-0 h-full w-1", accentColor)} />
      )}
      <CardHeader className={cn(
        "flex flex-row items-center justify-between",
        isHero ? "pb-1 pl-4" : "pb-2",
        isMini && "pb-1 pt-3",
      )}>
        <p className={cn(
          "font-semibold uppercase tracking-wider text-muted-foreground",
          isHero ? "text-[10px]" : "text-xs",
          isMini && "text-[10px]",
        )}>
          {title}
        </p>
        {Icon && <Icon className={cn("text-muted-foreground", isHero ? "h-5 w-5" : "h-4 w-4")} />}
      </CardHeader>
      <CardContent className={cn(isMini && "pb-3")}>
        <div className="flex items-end gap-2">
          <span className={cn(
            "font-bold leading-none",
            isHero ? "text-2xl" : "text-xl",
            isMini && "text-lg",
          )}>
            {formatValue(value, format, currencySymbol)}
          </span>
          {change !== null && (
            <span className={cn(
              "flex items-center gap-0.5 text-xs font-medium leading-none pb-0.5",
              isPositive && "text-emerald-600 dark:text-emerald-400",
              isNegative && "text-red-600 dark:text-red-400",
              isNeutral && "text-muted-foreground",
            )}>
              {isPositive && <ArrowUpRight className="h-3 w-3" />}
              {isNegative && <ArrowDownRight className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              {change !== null ? `${Math.abs(change).toFixed(1)}%` : "-"}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

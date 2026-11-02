"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@open-mtlms/core";
import { ArrowRight } from "lucide-react";

interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  title: string;
  description?: string;
  stages: FunnelStage[];
}

const DEFAULT_COLORS = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-green-500",
  "bg-teal-500",
];

export function FunnelChart({ title, description, stages }: FunnelChartProps) {
  if (stages.length === 0) return null;

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const widthPct = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 8) : 8;
            const conversionRate = i > 0 && stages[i - 1].value > 0
              ? ((stage.value / stages[i - 1].value) * 100).toFixed(1)
              : null;

            return (
              <div key={stage.label}>
                {i > 0 && (
                  <div className="flex items-center gap-1.5 mb-1.5 ml-2">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {conversionRate}% conversion
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-24 flex-shrink-0 text-right">
                    <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                  </div>
                  <div className="flex-1 relative">
                    <div
                      className={cn(
                        "h-8 rounded-md transition-all flex items-center px-3",
                        stage.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                      )}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-xs font-bold text-white whitespace-nowrap">
                        {stage.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

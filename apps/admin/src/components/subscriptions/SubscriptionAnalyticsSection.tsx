"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Loader2,
  Pause,
  TrendingDown,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { useSubscriptionAnalytics } from "@/lib/hooks/use-tenant-subscriptions";

// ─── Helpers ────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
  valueClassName,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold", valueClassName)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SubscriptionAnalyticsSection() {
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading } = useSubscriptionAnalytics();

  const mrrDisplay = useMemo(() => {
    if (!data?.mrr?.length) return "N/A";
    return data.mrr
      .map((m) => `${m.currency} ${m.amount.toLocaleString()}`)
      .join(", ");
  }, [data?.mrr]);

  const churnRate = useMemo(() => {
    if (!data?.summary) return "0.0%";
    const { cancelled, total } = data.summary;
    if (total === 0) return "0.0%";
    return `${((cancelled / total) * 100).toFixed(1)}%`;
  }, [data?.summary]);

  const revenueByPlanChartData = useMemo(() => {
    if (!data?.revenue_by_plan?.length) return [];
    return data.revenue_by_plan.map((r) => ({
      date: r.plan_name,
      count: r.subscriber_count,
    }));
  }, [data?.revenue_by_plan]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">
          Subscription Analytics
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="h-8 w-8 p-0 hover:bg-muted"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6 pt-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {data && (
            <>
              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Total Subscribers"
                  value={data.summary.total}
                  icon={Users}
                />
                <StatCard
                  label="Active"
                  value={data.summary.active}
                  icon={UserCheck}
                  className="border-green-200 bg-green-50/50"
                />
                <StatCard
                  label="MRR"
                  value={mrrDisplay}
                  icon={DollarSign}
                />
                <StatCard
                  label="Churn Rate"
                  value={churnRate}
                  icon={TrendingDown}
                />
                <StatCard
                  label="On Trial"
                  value={data.summary.on_trial}
                  icon={Clock}
                />
                <StatCard
                  label="Paused"
                  value={data.summary.paused}
                  icon={Pause}
                />
                <StatCard
                  label="Payment Failures"
                  value={data.summary.with_payment_failures}
                  icon={AlertTriangle}
                  valueClassName={
                    data.summary.with_payment_failures > 0
                      ? "text-destructive"
                      : undefined
                  }
                />
                <StatCard
                  label="Expired"
                  value={data.summary.expired}
                  icon={XCircle}
                />
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <AnalyticsAreaChart
                  title="Subscriber Growth"
                  data={data.growth_timeline ?? []}
                  dataKey="count"
                  name="Subscribers"
                />
                <AnalyticsPieChart
                  title="Status Distribution"
                  data={data.status_distribution ?? []}
                />
                <AnalyticsBarChart
                  title="Revenue by Plan"
                  data={revenueByPlanChartData}
                  dataKey="count"
                  name="Subscribers"
                />
                <AnalyticsLineChart
                  title="Churn Trend"
                  data={data.churn_timeline ?? []}
                  dataKey="count"
                  name="Churned"
                />
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

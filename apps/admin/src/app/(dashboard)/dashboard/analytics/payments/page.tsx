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
  Clock,
  CreditCard,
  DollarSign,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnalyticsDataTable } from "@/components/analytics/analytics-data-table";
import {
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
} from "@/components/analytics/chart-components";
import { CHART_COLORS } from "@/components/analytics/chart-utils";
import { ExportMenu } from "@/components/analytics/export-menu";
import { PaymentsFilterBar } from "@/components/analytics/payments-filter-bar";
import { AnalyticsSkeleton } from "@/components/analytics/shared";
import { TrendStat } from "@/components/analytics/trend-stat";
import {
  AvgOrderValueDisplay,
  RevenueBreakdownDisplay,
} from "@/components/shared/RevenueBreakdown";
import { analyticsApi, type PaymentAnalytics, type PaymentFilters } from "@/lib/api/analytics";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { buildPaymentsReport } from "@/lib/export/payments-report";
import { useAnalyticsPayments } from "@/lib/hooks/use-analytics";
import {
  COMBINED_REVENUE_SUBNOTE,
  formatInr,
  formatUsd,
} from "@/lib/utils/currency";

type ChartCurrency = "combined" | "inr" | "usd";

function toOrderExportRow(o: PaymentAnalytics["recent_orders"][number]) {
  return {
    "Order #": o.order_number,
    Member: o.member_name ?? "-",
    Email: o.member_email ?? "-",
    Amount: o.total_amount,
    Currency: o.currency,
    Status: o.status,
    Type: o.order_type,
    "Failure reason": o.failure_reason ?? "-",
    "Paid At": o.paid_at ? new Date(o.paid_at).toLocaleString() : "-",
    "Created At": new Date(o.created_at).toLocaleString(),
  };
}

export default function PaymentsAnalyticsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [chartCurrency, setChartCurrency] = useState<ChartCurrency>("combined");
  const { data, isLoading } = useAnalyticsPayments(page, search, filters);
  const {
    dateRange: { startDate, endDate, label: dateLabel },
  } = useAnalyticsDateRange();

  const handleFiltersChange = (next: PaymentFilters) => {
    setFilters(next);
    setPage(1);
  };

  // Pull the full filtered order set (not just the page) for exports.
  const fetchAllOrders = async () => {
    const res = await analyticsApi.getPayments(startDate, endDate, 1, 20000, search || undefined, filters);
    return res.recent_orders ?? [];
  };

  const statusDistribution = useMemo(() => {
    const paid = data?.paid ?? 0;
    const failed = data?.failed ?? 0;
    const refunded = data?.refunded ?? 0;
    const pending = data?.pending ?? 0;
    return [
      ...(paid > 0 ? [{ name: "PAID", value: paid }] : []),
      ...(failed > 0 ? [{ name: "FAILED", value: failed }] : []),
      ...(refunded > 0 ? [{ name: "REFUNDED", value: refunded }] : []),
      ...(pending > 0 ? [{ name: "PENDING", value: pending }] : []),
    ];
  }, [data?.paid, data?.failed, data?.refunded, data?.pending]);

  const orderTypeDistribution = useMemo(() => {
    const byType = data?.by_type ?? [];
    return byType
      .filter((t) => (t.count ?? 0) > 0)
      .map((t) => ({
        name: String(t.type ?? "Unknown").replace(/_/g, " "),
        value: t.count ?? 0,
      }));
  }, [data?.by_type]);

  // Flatten daily_revenue per selected currency toggle. Always keep the
  // split numbers in the row so the line-chart tooltip can show them.
  const dailyRevenueChartData = useMemo(() => {
    const rows = data?.daily_revenue ?? [];
    return rows.map((r) => ({
      date: r.date,
      amount:
        chartCurrency === "inr"
          ? r.amount.inr
          : chartCurrency === "usd"
            ? r.amount.usd
            : r.amount.combined_inr,
      amount_inr: r.amount.inr,
      amount_usd: r.amount.usd,
      amount_combined: r.amount.combined_inr,
      count: r.count,
    }));
  }, [data?.daily_revenue, chartCurrency]);

  if (isLoading) return <AnalyticsSkeleton />;
  if (!data)
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No payment data available
      </p>
    );

  const totalOrders = data.total_orders ?? 0;
  const paid = data.paid ?? 0;
  const failed = data.failed ?? 0;
  const pending = data.pending ?? 0;
  const refunded = data.refunded ?? 0;
  const recentOrders = data.recent_orders ?? [];
  const failureReasonData = (data.failure_reasons ?? []).map((f) => ({
    date: f.reason,
    count: f.count,
  }));
  const recentOrdersTotal = data.recent_orders_total ?? 0;

  const ordersExport = recentOrders.map(toOrderExportRow);

  const chartTitle =
    chartCurrency === "inr"
      ? "Daily Revenue (INR)"
      : chartCurrency === "usd"
        ? "Daily Revenue (USD)"
        : "Daily Revenue (≈ INR, Combined)";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Payments Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Revenue and order insights: INR and USD payments shown separately
          </p>
        </div>
        <ExportMenu
          data={ordersExport}
          getData={async () => (await fetchAllOrders()).map(toOrderExportRow)}
          buildReport={{
            run: async () => {
              const orders = await fetchAllOrders();
              await buildPaymentsReport(data, orders, { dateLabel });
            },
          }}
          fileName="payments-analytics"
          sheetName="Orders"
        />
      </div>

      {/* Filters, narrow the orders drill-down, then export the full filtered set */}
      <PaymentsFilterBar value={filters} onChange={handleFiltersChange} />

      {/* Multi-currency revenue card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Total Revenue
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {totalOrders} total orders · {paid} paid
          </span>
        </CardHeader>
        <CardContent>
          <RevenueBreakdownDisplay
            value={data.total_revenue}
            variant="inline"
            showSubnote
          />
        </CardContent>
      </Card>

      {/* Secondary stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <AvgOrderValueDisplay
              inr={data.avg_order_value_inr}
              usd={data.avg_order_value_usd}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {data.paid_inr} INR orders · {data.paid_usd} USD orders
            </p>
          </CardContent>
        </Card>
        <TrendStat
          title="Paid Orders"
          value={paid}
          icon={TrendingUp}
          accentColor="bg-emerald-500"
        />
        <TrendStat
          title="Failed"
          value={failed}
          subtitle={formatInr(data.failed_amount.combined_inr)}
          icon={AlertTriangle}
          accentColor="bg-red-500"
        />
        <TrendStat
          title="Pending"
          value={pending}
          subtitle={formatInr(data.pending_amount.combined_inr)}
          icon={Clock}
          accentColor="bg-amber-500"
        />
        <TrendStat
          title="Refunded"
          value={refunded}
          subtitle={formatInr(data.refunded_amount.combined_inr)}
          icon={RotateCcw}
          accentColor="bg-violet-500"
        />
      </div>

      {/* Daily Revenue chart with currency toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <div>
            <CardTitle className="text-base">{chartTitle}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revenue trend over selected period
            </p>
          </div>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {(["combined", "inr", "usd"] as const).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={chartCurrency === c ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setChartCurrency(c)}
              >
                {c === "combined" ? "Combined" : c.toUpperCase()}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {dailyRevenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={dailyRevenueChartData}
                margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
              >
                <defs>
                  <linearGradient id="paymentsRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => {
                    const sym = chartCurrency === "usd" ? "$" : "₹";
                    return `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`;
                  }}
                  className="text-muted-foreground"
                />
                <RechartTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: unknown, _n: unknown, entry: unknown) => {
                    const payload = (entry as {
                      payload?: {
                        amount_inr?: number;
                        amount_usd?: number;
                      };
                    })?.payload;
                    const inr = payload?.amount_inr ?? 0;
                    const usd = payload?.amount_usd ?? 0;
                    const main =
                      chartCurrency === "usd"
                        ? formatUsd(Number(value ?? 0))
                        : formatInr(Number(value ?? 0));
                    return [
                      `${main} (${formatInr(inr)} + ${formatUsd(usd)})`,
                      "Revenue",
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={CHART_COLORS[1]}
                  fill="url(#paymentsRevGrad)"
                  strokeWidth={2}
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No revenue data in range
            </p>
          )}
          {chartCurrency === "combined" && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {COMBINED_REVENUE_SUBNOTE(data.conversion_rate)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution | Order Type */}
      <div className="grid gap-4 md:grid-cols-2">
        {statusDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Status Distribution"
            description="Orders by status"
            data={statusDistribution}
          />
        )}
        {orderTypeDistribution.length > 0 && (
          <AnalyticsPieChart
            title="Order Type Distribution"
            description="Orders by type"
            data={orderTypeDistribution}
          />
        )}
      </div>

      {/* Failure report, why payments fail, most common first */}
      {failureReasonData.length > 0 && (
        <AnalyticsBarChart
          title="Top Failure Reasons"
          description="Why failed payments did not go through"
          data={failureReasonData}
          dataKey="count"
          name="Failed orders"
          layout="vertical"
          height={Math.max(180, failureReasonData.length * 34)}
        />
      )}

      {/* Revenue by Type, explicit INR/USD split in a table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by Order Type</CardTitle>
          <p className="text-xs text-muted-foreground">
            Each order type broken down by payment currency
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                    Type
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                    Orders
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                    INR Revenue
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                    USD Revenue
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                    Combined (≈ INR)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.by_type ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No revenue breakdown
                    </td>
                  </tr>
                ) : (
                  data.by_type.map((t) => (
                    <tr key={t.type} className="border-b last:border-0">
                      <td className="px-3 py-2 capitalize">
                        {String(t.type).toLowerCase().replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.count}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatInr(t.revenue.inr)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatUsd(t.revenue.usd)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatInr(t.revenue.combined_inr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs Orders, dual-axis line */}
      {dailyRevenueChartData.length > 0 && (
        <AnalyticsLineChart
          title={`Revenue vs Orders (${chartCurrency === "usd" ? "USD" : chartCurrency === "inr" ? "INR" : "Combined ≈ INR"})`}
          description="Daily revenue and order count"
          data={dailyRevenueChartData}
          lines={[
            {
              dataKey: "amount",
              name: chartCurrency === "usd" ? "Revenue (USD)" : "Revenue (INR)",
              color: CHART_COLORS[0],
              yAxisId: "left",
            },
            { dataKey: "count", name: "Orders", color: CHART_COLORS[1], yAxisId: "right" },
          ]}
          height={300}
        />
      )}

      {/* Recent orders table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsDataTable
            columns={[
              { key: "order_number", label: "Order #" },
              { key: "member_name", label: "Member" },
              {
                key: "total_amount",
                label: "Amount",
                align: "right",
                render: (row) => {
                  const amount = parseFloat(String(row.total_amount ?? "0"));
                  const currency = String(row.currency ?? "INR");
                  return currency === "USD" ? formatUsd(amount) : formatInr(amount);
                },
              },
              { key: "currency", label: "Currency" },
              { key: "status", label: "Status" },
              { key: "order_type", label: "Type" },
              {
                key: "failure_reason",
                label: "Reason",
                render: (row) => String(row.failure_reason ?? "-"),
              },
              { key: "created_at", label: "Date", format: "date" },
            ]}
            data={recentOrders as unknown as Array<Record<string, unknown>>}
            total={recentOrdersTotal}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Search orders..."
            emptyMessage="No recent orders"
          />
        </CardContent>
      </Card>
    </div>
  );
}

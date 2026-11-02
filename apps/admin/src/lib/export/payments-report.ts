/**
 * Builds the graphical Payments analytics Excel report: a branded Summary sheet
 * (KPIs + insights + embedded charts) plus Daily Revenue, By Type,
 * Failures & Pending and All Orders detail sheets.
 */
import { formatChartDate } from "@/components/analytics/chart-utils";
import type { PaymentAnalytics } from "@/lib/api/analytics";
import { formatInr, formatUsd } from "@/lib/utils/currency";

import {
  renderBarChart,
  renderDonutChart,
  renderLineChart,
  STATUS_COLORS,
} from "./chart-canvas";
import {
  addSummarySheet,
  addTableSheet,
  createWorkbook,
  downloadWorkbook,
  type Kpi,
} from "./excel-report";

type Order = PaymentAnalytics["recent_orders"][number];

const PENDING_STATUSES = new Set(["CREATED", "PAYMENT_PENDING"]);
const FAILED_STATUSES = new Set(["FAILED", "EXPIRED"]);

function pretty(token: string): string {
  return token
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

export interface PaymentsReportMeta {
  tenantName?: string;
  dateLabel?: string;
}

export async function buildPaymentsReport(
  data: PaymentAnalytics,
  ordersAll: Order[],
  meta: PaymentsReportMeta = {},
): Promise<void> {
  const wb = createWorkbook();
  const rev = data.total_revenue;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis: Kpi[] = [
    { label: "Total revenue", value: formatInr(rev.combined_inr), note: "Combined, INR equivalent" },
    { label: "Revenue (INR)", value: formatInr(rev.inr) },
    { label: "Revenue (USD)", value: formatUsd(rev.usd) },
    { label: "Total orders", value: String(data.total_orders) },
    { label: "Paid", value: String(data.paid), note: `${pct(data.paid, data.total_orders)} success` },
    { label: "Failed", value: String(data.failed), note: formatInr(data.failed_amount.combined_inr) },
    { label: "Pending", value: String(data.pending), note: formatInr(data.pending_amount.combined_inr) },
    { label: "Refunded", value: String(data.refunded), note: formatInr(data.refunded_amount.combined_inr) },
    { label: "Success rate", value: pct(data.paid, data.total_orders) },
    { label: "Failure rate", value: pct(data.failed, data.total_orders) },
  ];
  if (data.avg_order_value_inr != null) kpis.push({ label: "Avg order value (INR)", value: formatInr(data.avg_order_value_inr) });
  if (data.avg_order_value_usd != null) kpis.push({ label: "Avg order value (USD)", value: formatUsd(data.avg_order_value_usd) });

  // ── Insights ────────────────────────────────────────────────────────────────
  const insights: string[] = [];
  insights.push(`${pct(data.paid, data.total_orders)} of ${data.total_orders} orders were paid; ${pct(data.failed, data.total_orders)} failed.`);
  if (data.failure_reasons.length) {
    const top = data.failure_reasons[0];
    insights.push(`Top failure reason: ${top.reason} (${top.count} order${top.count === 1 ? "" : "s"}).`);
  }
  const peak = [...data.daily_revenue].sort((a, b) => b.amount.combined_inr - a.amount.combined_inr)[0];
  if (peak && peak.amount.combined_inr > 0) {
    insights.push(`Peak revenue day: ${formatChartDate(peak.date)} (${formatInr(peak.amount.combined_inr)}).`);
  }
  if (data.pending > 0) {
    insights.push(`${data.pending} pending order${data.pending === 1 ? "" : "s"} worth ${formatInr(data.pending_amount.combined_inr)} await completion.`);
  }

  // ── Charts ────────────────────────────────────────────────────────────────
  const charts = [
    renderDonutChart("Order status", [
      { label: "Paid", value: data.paid, color: STATUS_COLORS.PAID },
      { label: "Failed", value: data.failed, color: STATUS_COLORS.FAILED },
      { label: "Pending", value: data.pending, color: STATUS_COLORS.PENDING },
      { label: "Refunded", value: data.refunded, color: STATUS_COLORS.REFUNDED },
    ]),
    renderLineChart(
      "Orders over time",
      data.daily_orders.map((d) => formatChartDate(d.date)),
      [
        { name: "Paid", color: STATUS_COLORS.PAID, values: data.daily_orders.map((d) => d.paid) },
        { name: "Failed", color: STATUS_COLORS.FAILED, values: data.daily_orders.map((d) => d.failed) },
        { name: "Pending", color: STATUS_COLORS.PENDING, values: data.daily_orders.map((d) => d.pending) },
      ],
    ),
    renderBarChart(
      "Revenue by type (INR eq.)",
      [...data.by_type]
        .sort((a, b) => b.revenue.combined_inr - a.revenue.combined_inr)
        .map((t) => ({ label: pretty(t.type), value: Math.round(t.revenue.combined_inr) })),
      560,
      320,
      (n) => formatInr(n),
    ),
    renderBarChart(
      "Top failure reasons",
      data.failure_reasons.map((f) => ({ label: f.reason, value: f.count, color: STATUS_COLORS.FAILED })),
    ),
  ];

  addSummarySheet(wb, {
    name: "Summary",
    title: `${meta.tenantName ? meta.tenantName + ", " : ""}Payments report`,
    subtitle: meta.dateLabel,
    kpis,
    insights,
    charts,
  });

  // ── Daily Revenue ───────────────────────────────────────────────────────────
  addTableSheet(wb, {
    name: "Daily Revenue",
    columns: [
      { header: "Date", key: "date", width: 14 },
      { header: "INR", key: "inr", width: 14, numFmt: "#,##0" },
      { header: "USD", key: "usd", width: 14, numFmt: "#,##0" },
      { header: "Combined (INR eq.)", key: "combined", width: 20, numFmt: "#,##0" },
      { header: "Orders", key: "orders", width: 10 },
    ],
    rows: data.daily_revenue.map((d) => ({
      date: d.date,
      inr: Math.round(d.amount.inr),
      usd: Math.round(d.amount.usd),
      combined: Math.round(d.amount.combined_inr),
      orders: d.count,
    })),
    dataBarColumn: "combined",
  });

  // ── By Type ─────────────────────────────────────────────────────────────────
  addTableSheet(wb, {
    name: "By Type",
    columns: [
      { header: "Type", key: "type", width: 22 },
      { header: "Paid orders", key: "count", width: 14 },
      { header: "Revenue (INR eq.)", key: "revenue", width: 20, numFmt: "#,##0" },
    ],
    rows: [...data.by_type]
      .sort((a, b) => b.revenue.combined_inr - a.revenue.combined_inr)
      .map((t) => ({ type: pretty(t.type), count: t.count, revenue: Math.round(t.revenue.combined_inr) })),
    dataBarColumn: "revenue",
  });

  // ── Failures & Pending (the failure report) ──────────────────────────────────
  const orderColumns = [
    { header: "Order #", key: "order", width: 20 },
    { header: "Member", key: "member", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Amount", key: "amount", width: 14, numFmt: "#,##0.00" },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Status", key: "status", width: 16 },
    { header: "Type", key: "type", width: 18 },
    { header: "Failure reason", key: "reason", width: 30 },
    { header: "Created", key: "created", width: 20 },
  ];
  const toRow = (o: Order) => ({
    order: o.order_number,
    member: o.member_name ?? "-",
    email: o.member_email ?? "-",
    amount: parseFloat(o.total_amount) || 0,
    currency: o.currency,
    status: pretty(o.status),
    type: pretty(o.order_type),
    reason: o.failure_reason ?? "",
    created: new Date(o.created_at).toLocaleString(),
  });

  const failuresPending = ordersAll.filter((o) => FAILED_STATUSES.has(o.status) || PENDING_STATUSES.has(o.status));
  addTableSheet(wb, {
    name: "Failures & Pending",
    columns: orderColumns,
    rows: failuresPending.map(toRow),
  });

  // ── All Orders (full filtered set) ───────────────────────────────────────────
  addTableSheet(wb, {
    name: "All Orders",
    columns: [
      ...orderColumns.slice(0, 7),
      { header: "Paid at", key: "paid", width: 20 },
    ],
    rows: ordersAll.map((o) => ({
      ...toRow(o),
      paid: o.paid_at ? new Date(o.paid_at).toLocaleString() : "-",
    })),
  });

  const stamp = meta.dateLabel ? `-${meta.dateLabel.replace(/[^\dA-Za-z]+/g, "-")}` : "";
  await downloadWorkbook(wb, `payments-report${stamp}`);
}

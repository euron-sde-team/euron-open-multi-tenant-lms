"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@open-mtlms/core";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";

import { SubscriptionAnalyticsSection } from "@/components/subscriptions/SubscriptionAnalyticsSection";
import {
  useSubscribers,
  useSubscriberDetail,
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from "@/lib/hooks/use-tenant-subscriptions";

// ─── Helpers ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function formatAmount(amount: string, currency: string) {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  const symbols: Record<string, string> = { INR: "\u20B9", USD: "$", EUR: "\u20AC", GBP: "\u00A3" };
  const symbol = symbols[currency.toUpperCase()] ?? currency + " ";
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "border-green-300 bg-green-50 text-green-700" },
  AUTHENTICATED: { label: "Authenticated", className: "border-amber-300 bg-amber-50 text-amber-700" },
  PENDING: { label: "Pending", className: "border-amber-300 bg-amber-50 text-amber-700" },
  HALTED: { label: "Halted", className: "border-red-300 bg-red-50 text-red-700" },
  CANCELLED: { label: "Cancelled", className: "border-red-300 bg-red-50 text-red-700" },
  PAUSED: { label: "Paused", className: "border-gray-300 bg-gray-50 text-gray-700" },
  CREATED: { label: "Created", className: "border-blue-300 bg-blue-50 text-blue-700" },
  EXPIRED: { label: "Expired", className: "border-red-300 bg-red-50 text-red-700" },
  COMPLETED: { label: "Completed", className: "border-green-300 bg-green-50 text-green-700" },
};

function SubscriptionStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-gray-300 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// ─── Subscriber Detail Dialog ────────────────────────────────────────────

function SubscriberDetailDialog({
  subscriberId,
  open,
  onClose,
}: {
  subscriberId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useSubscriberDetail(subscriberId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Subscriber Details</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        )}

        {detail && (
          <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-1">
            {/* Member Info */}
            <div className="flex items-center gap-4">
              {detail.member_avatar_url ? (
                <img
                  src={detail.member_avatar_url}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {detail.member_name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
              )}
              <div>
                <p className="text-lg font-medium">{detail.member_name}</p>
                <p className="text-muted-foreground text-sm">{detail.member_email}</p>
              </div>
              <div className="ml-auto">
                <SubscriptionStatusBadge status={detail.status} />
              </div>
            </div>

            {/* Subscription Info Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Plan" value={detail.plan_name_snapshot} />
              <InfoRow label="Billing Cycle" value={detail.billing_cycle_snapshot} />
              <InfoRow
                label="Amount"
                value={formatAmount(detail.amount_snapshot, detail.currency_snapshot)}
              />
              <InfoRow label="Gateway" value={detail.gateway_provider} />
              <InfoRow label="Current Period Start" value={formatDate(detail.current_period_start)} />
              <InfoRow label="Current Period End" value={formatDate(detail.current_period_end)} />
              <InfoRow label="Next Charge" value={formatDate(detail.next_charge_at)} />
              <InfoRow label="Trial Ends" value={formatDate(detail.trial_ends_at)} />
              <InfoRow label="Created" value={formatDate(detail.created_at)} />
              <InfoRow label="Last Payment" value={formatDate(detail.last_payment_at)} />
              {detail.last_payment_amount && (
                <InfoRow
                  label="Last Payment Amount"
                  value={formatAmount(detail.last_payment_amount, detail.currency_snapshot)}
                />
              )}
              <InfoRow
                label="Payment Failures"
                value={String(detail.payment_failure_count)}
              />
              {detail.cancelled_at && (
                <InfoRow label="Cancelled At" value={formatDateTime(detail.cancelled_at)} />
              )}
              {detail.paused_at && (
                <InfoRow label="Paused At" value={formatDateTime(detail.paused_at)} />
              )}
              {detail.grace_period_ends_at && (
                <InfoRow
                  label="Grace Period Ends"
                  value={formatDate(detail.grace_period_ends_at)}
                />
              )}
              {detail.cancel_at_period_end && (
                <InfoRow label="Cancel at Period End" value="Yes" />
              )}
            </div>

            {/* Event Timeline */}
            {detail.events && detail.events.length > 0 && (
              <div>
                <h4 className="mb-3 font-medium">Event Timeline</h4>
                <div className="space-y-3">
                  {detail.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 rounded-md border p-3 text-sm"
                    >
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {evt.event_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-muted-foreground text-xs whitespace-nowrap">
                            {formatDateTime(evt.created_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
                          {evt.previous_status && (
                            <>
                              <SubscriptionStatusBadge status={evt.previous_status} />
                              <span>&rarr;</span>
                            </>
                          )}
                          <SubscriptionStatusBadge status={evt.new_status} />
                          {evt.amount && <span className="ml-2">{evt.amount}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function SubscribersPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    type: "cancel" | "pause" | "resume";
    name: string;
  } | null>(null);

  const { data, isLoading, error } = useSubscribers({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const cancelSub = useCancelSubscription();
  const pauseSub = usePauseSubscription();
  const resumeSub = useResumeSubscription();

  const subscribers = data?.subscribers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const { id, type } = confirmAction;
    const mutation = type === "cancel" ? cancelSub : type === "pause" ? pauseSub : resumeSub;

    mutation.mutate(id, {
      onSuccess: () => {
        setConfirmAction(null);
        toast({
          title: "Success",
          description: `Subscription ${type === "cancel" ? "cancelled" : type === "pause" ? "paused" : "resumed"} successfully.`,
        });
      },
      onError: (err: Error) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const actionPending = cancelSub.isPending || pauseSub.isPending || resumeSub.isPending;

  return (
    <div className="space-y-6">
      <SubscriptionAnalyticsSection />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Subscribers</h1>
        <p className="text-muted-foreground">
          View and manage active subscribers across all plans.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="AUTHENTICATED">Authenticated</SelectItem>
            <SelectItem value="HALTED">Halted</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="CREATED">Created</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-muted-foreground ml-auto text-sm">
          <strong>{total}</strong> subscriber{total !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Failed to load subscribers</p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !error && subscribers.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Member</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Next Charge</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{sub.member_name}</p>
                        <p className="text-muted-foreground text-xs">{sub.member_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{sub.plan_name_snapshot}</p>
                      <p className="text-muted-foreground text-xs">{sub.billing_cycle_snapshot}</p>
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionStatusBadge status={sub.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatAmount(sub.amount_snapshot, sub.currency_snapshot)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(sub.next_charge_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDetailId(sub.id)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {sub.status === "ACTIVE" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700"
                              onClick={() =>
                                setConfirmAction({
                                  id: sub.id,
                                  type: "pause",
                                  name: sub.member_name,
                                })
                              }
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() =>
                                setConfirmAction({
                                  id: sub.id,
                                  type: "cancel",
                                  name: sub.member_name,
                                })
                              }
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {sub.status === "PAUSED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700"
                            onClick={() =>
                              setConfirmAction({
                                id: sub.id,
                                type: "resume",
                                name: sub.member_name,
                              })
                            }
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && subscribers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">
              {search || statusFilter !== "all"
                ? "No subscribers found"
                : "No subscribers yet"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter."
                : "Subscribers will appear here once users subscribe to your plans."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {detailId && (
        <SubscriberDetailDialog
          subscriberId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Confirm Action Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "cancel"
                ? "Cancel Subscription"
                : confirmAction?.type === "pause"
                  ? "Pause Subscription"
                  : "Resume Subscription"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "cancel"
                ? `Are you sure you want to cancel the subscription for ${confirmAction.name}? This action may not be reversible.`
                : confirmAction?.type === "pause"
                  ? `Are you sure you want to pause the subscription for ${confirmAction?.name}? The user will not be charged while paused.`
                  : `Are you sure you want to resume the subscription for ${confirmAction?.name}? Billing will resume from the next cycle.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmAction?.type === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              disabled={actionPending}
            >
              {actionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction?.type === "cancel"
                ? "Cancel Subscription"
                : confirmAction?.type === "pause"
                  ? "Pause Subscription"
                  : "Resume Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

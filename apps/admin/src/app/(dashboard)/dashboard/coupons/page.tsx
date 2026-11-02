"use client";

import { Badge, Button, Card, CardContent, useToast } from "@open-mtlms/core";
import { BarChart3, Edit, Plus, Power, Ticket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatMoney, getErrorMessage } from "@open-mtlms/shared";

import { useCoupons, useDeleteCoupon, useToggleCoupon } from "@/lib/hooks/use-coupons";
import { PermissionGate } from "@/components/permission-gate";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CouponsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCoupons({ page, limit: 20 });
  const toggleMutation = useToggleCoupon();
  const deleteMutation = useDeleteCoupon();

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id, {
      onError: (err) => toast({ title: "Failed to toggle coupon", description: getErrorMessage(err), variant: "destructive" }),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: "Coupon deleted" }),
      onError: (err) => toast({ title: "Failed to delete coupon", description: getErrorMessage(err), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground text-sm">Manage discount coupons for your products.</p>
        </div>
        <PermissionGate requires="coupons.create">
          <Button asChild>
            <Link href="/dashboard/coupons/new">
              <Plus className="mr-2 h-4 w-4" />
              New Coupon
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
      ) : !data?.coupons.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">No coupons yet</h3>
            <p className="text-muted-foreground mb-4 text-center text-sm">
              Create discount coupons to boost sales and reward your customers.
            </p>
            <PermissionGate requires="coupons.create">
              <Button asChild>
                <Link href="/dashboard/coupons/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Coupon
                </Link>
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Discount</th>
                <th className="px-4 py-3 text-left font-medium">Valid</th>
                <th className="px-4 py-3 text-left font-medium">Uses</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.coupons.map((coupon) => (
                <tr key={coupon.id} className={cn(!coupon.isActive && "opacity-60")}>
                  <td className="px-4 py-3 font-mono font-medium">{coupon.code}</td>
                  <td className="px-4 py-3">
                    {coupon.discountType === "FIXED"
                      ? `${formatMoney(coupon.discountValue, coupon.currency ?? "INR")} off`
                      : `${coupon.discountValue}% off`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatDate(coupon.validFrom)}
                    {coupon.validTo && ` – ${formatDate(coupon.validTo)}`}
                  </td>
                  <td className="px-4 py-3">
                    {coupon.usedCount}
                    {coupon.maxUses ? `/${coupon.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={coupon.isActive ? "default" : "secondary"}>
                        {coupon.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {/* Private codes never appear on the storefront, so the
                          distinction has to be visible at a glance here. */}
                      {!coupon.isPublic && (
                        <Badge variant="outline" title="Never listed on checkout, works only when typed in">
                          Private
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <PermissionGate requires="coupons.update">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggle(coupon.id)}
                          title={coupon.isActive ? "Deactivate" : "Activate"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Analytics">
                        <Link href={`/dashboard/coupons/${coupon.id}`}>
                          <BarChart3 className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Edit">
                        <Link href={`/dashboard/coupons/${coupon.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <PermissionGate requires="coupons.delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => handleDelete(coupon.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.total ?? 0) > 20 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-muted-foreground text-sm">
                Page {data.page} ({data.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= (data.total ?? 0)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

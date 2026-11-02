"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import { ShoppingCart } from "lucide-react";

import { useMemberCartItems } from "../../../lib/hooks/use-members";
import type { MemberCartItem } from "../../../lib/types/members";
import { MemberDataTable, type Column } from "../shared/MemberDataTable";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CartTabProps {
  memberId: string;
  enabled: boolean;
}

export function CartTab({ memberId, enabled }: CartTabProps) {
  const { data: cartItems, isLoading } = useMemberCartItems(memberId, enabled);

  const columns: Column<MemberCartItem>[] = [
    {
      key: "item",
      label: "Item",
      render: (c) => <span className="font-medium">{c.item_title}</span>,
    },
    {
      key: "type",
      label: "Type",
      render: (c) => (
        <Badge variant="outline" className="text-[10px]">
          {c.item_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "coupon",
      label: "Coupon Applied",
      render: (c) =>
        c.coupon_code ? (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {c.coupon_code}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "added",
      label: "Added",
      render: (c) => (
        <span className="text-muted-foreground">{formatDate(c.created_at)}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" /> Cart Items
        </CardTitle>
        <CardDescription>
          Items currently in this student&apos;s shopping cart
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MemberDataTable
          columns={columns}
          data={cartItems}
          isLoading={isLoading}
          emptyMessage="Cart is empty."
          emptyIcon={ShoppingCart}
          keyExtractor={(c) => c.id}
        />
      </CardContent>
    </Card>
  );
}

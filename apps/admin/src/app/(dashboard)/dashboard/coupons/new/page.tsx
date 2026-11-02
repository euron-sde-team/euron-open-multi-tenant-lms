"use client";

import { Button } from "@open-mtlms/core";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CouponForm } from "@/components/coupons/CouponForm";

export default function NewCouponPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/coupons">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Coupon</h1>
          <p className="text-muted-foreground text-sm">Create a discount coupon.</p>
        </div>
      </div>
      <CouponForm />
    </div>
  );
}

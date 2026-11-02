"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@open-mtlms/core";
import type { ContentPrice } from "@open-mtlms/shared";
import { DollarSign } from "lucide-react";
import { useCallback, useMemo } from "react";

import { MultiCurrencyPriceEditor } from "@/components/pricing/MultiCurrencyPriceEditor";
import { PricePreview } from "@/components/pricing/PricePreview";
import { useCourseStore } from "@/lib/stores/course-store";
import { legacyToPrices, pricesToLegacy } from "@/lib/utils/price-fields";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingModal({ open, onOpenChange }: PricingModalProps) {
  const { courseData, updatePricing, updateSettings } = useCourseStore();

  const handlePurchaseModeChange = (mode: string) => {
    updateSettings({ purchaseMode: mode as "FREE" | "PAID" });
  };

  const prices = useMemo<ContentPrice[]>(
    () =>
      courseData.prices ??
      legacyToPrices(
        courseData.webPriceINR,
        courseData.webPriceUSD,
        courseData.webDiscount,
        courseData.mobileDiscount
      ),
    [
      courseData.prices,
      courseData.webPriceINR,
      courseData.webPriceUSD,
      courseData.webDiscount,
      courseData.mobileDiscount,
    ]
  );

  const handlePricesChange = useCallback(
    (next: ContentPrice[]) => {
      const legacy = pricesToLegacy(next);
      updatePricing({
        prices: next,
        webPriceINR: legacy.inr ?? 0,
        mobilePriceINR: legacy.inr ?? 0,
        webPriceUSD: legacy.usd ?? 0,
        mobilePriceUSD: legacy.usd ?? 0,
        webDiscount: legacy.discountInr ?? 0,
        mobileDiscount: legacy.discountUsd ?? 0,
      });
    },
    [updatePricing]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto py-1 pr-1">
          {/* Validity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="lifetimeAccess">Lifetime access</Label>
                <p className="text-xs text-muted-foreground">
                  Learners keep access forever, with no expiry.
                </p>
              </div>
              <Switch
                id="lifetimeAccess"
                checked={courseData.validityDays === null}
                onCheckedChange={(checked) => {
                  updateSettings({ validityDays: checked ? null : 365 });
                }}
              />
            </div>
            {courseData.validityDays !== null && (
              <>
                <Label htmlFor="validityDays">Access Validity (Days)</Label>
                <Input
                  id="validityDays"
                  type="number"
                  min="1"
                  value={courseData.validityDays ?? 365}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    updateSettings({ validityDays: Number.isNaN(v) || v < 1 ? 365 : v });
                  }}
                  placeholder="365"
                />
                <p className="text-xs text-muted-foreground">
                  Access is valid for this many days after purchase. Default: 365.
                </p>
              </>
            )}
          </div>

          {/* Purchase Mode */}
          <div className="space-y-2">
            <Label>Purchase Mode</Label>
            <Select
              value={courseData.purchaseMode}
              onValueChange={handlePurchaseModeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purchase mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free Course</SelectItem>
                <SelectItem value="PAID">Paid Course</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {courseData.purchaseMode === "PAID" && (
            <>
              {/* Multi-currency price book (one row per enabled currency) */}
              <MultiCurrencyPriceEditor
                value={prices}
                onChange={handlePricesChange}
                discountMode="percent"
              />

              <p className="text-muted-foreground text-xs">
                All prices should be inclusive of applicable taxes. No additional taxes will be charged to the buyer.
              </p>

              {/* Price Preview: one entry per priced currency from the price book */}
              <PricePreview prices={prices} />
            </>
          )}

          {courseData.purchaseMode === "FREE" && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">FREE</p>
              <p className="text-sm text-muted-foreground mt-1">
                This course is free for all users
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
